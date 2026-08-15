#!/usr/bin/env python3
"""Generate the 30-credit Common Core course -> area mapping.

Two sources, merged:

1. WCQ (w5.ab.ust.hk) — the authoritative registrar data.  Per-cohort area
   designations (cc22 = admitted 2022-24, cc25 = admitted 2025,
   cc26 = admitted from 2026), scraped by scripts/scrape_wcq_cc.py into
   data/wcq_cc_areas.json.  WCQ only lists courses *offered* in the scraped
   terms (2520-2610), and a cohort list being empty can mean the
   designation expired before that term.

2. The official active-course-list PDF
   (uce.ust.hk/web/resources/Active_Course_List_30-credit.pdf).  Course
   rows are parsed geometrically (the table is rotated 90°); area cells
   for courses WCQ no longer lists are resolved from the PDF's
   area/remarks column via CURATED_CELLS — a hand-verified table built by
   cross-checking every orphan cell against WCQ, the per-year course
   catalogs, and the CORE-prefix lists.

Usage:
  python3 scripts/scrape_cc_courses.py

Output: data/common_core_courses.json
  [{code, title, credits, areas, areaByCohort, remark, coreCode, prev}]
"""

import io
import json
import re
from pathlib import Path

import requests
import pypdf

URL = "https://uce.ust.hk/web/resources/Active_Course_List_30-credit.pdf"
ROOT = Path(__file__).resolve().parent.parent
WCQ_PATH = ROOT / "data" / "wcq_cc_areas.json"
OUTPUT = ROOT / "data" / "common_core_courses.json"

# Course code at fragment start: "COMP 1942 …"
CODE_RE = re.compile(r'^([A-Z]{3,5})\s+(\d{4}[A-Z]?H?)\s+(.+)$')

# Known Common Core area tokens (30-credit program)
AREAS = {"CTDL", "HMW", "E-Comm", "C-Comm", "HAIC", "UXOP", "S&T",
         "SUS", "A", "H", "S", "T", "SA"}

# Areas sorted longest-first for glue-join matching ("C - C o m m" → "C-Comm")
AREAS_BY_LEN = sorted(AREAS, key=len, reverse=True)


def _consume_areas(tokens: list[str]) -> tuple[list[str], list[str]]:
    """Split leading area tokens from the rest.

    Area cells look like "SA", "S", "T, SUS", "A, H", or split fragments
    such as "C - C o m m" (= C-Comm).  Stops at the first token that is
    not an area.
    """
    areas: list[str] = []
    i, n = 0, len(tokens)
    while i < n:
        tok = tokens[i].strip(",&")
        if tok in AREAS:
            areas.append(tok)
            i += 1
            continue
        # Glue-join path: "C", "-", "C", "o", "m", "m" → "C-Comm"
        joined = "".join(t.strip(",&") for t in tokens[i:i + 8]).lower()
        matched = None
        for a in AREAS_BY_LEN:
            if joined.startswith(a.lower()):
                matched = a
                break
        if matched is None:
            break
        areas.append(matched)
        consumed = 0
        while consumed < len(matched) and i < n:
            consumed += len(tokens[i].strip(",&"))
            i += 1
        if consumed < len(matched):
            break  # ran out of tokens mid-area; stop
    return areas, tokens[i:]


def _parse_main(fragment: str) -> dict | None:
    """Parse the main fragment: 'HUMA 1011 Linguistics in Life 3 H This is…'"""
    m = CODE_RE.match(fragment)
    if not m:
        return None
    subj, num, rest = m.groups()
    tokens = rest.split()

    # Title = tokens before the credit token ("3", "3H", "3A"…)
    title_tokens: list[str] = []
    credits: int | None = None
    areas: list[str] = []
    remark: list[str] = []
    for i, tok in enumerate(tokens):
        cm = re.match(r'^(\d)(.*)$', tok)
        if cm and (cm.group(2) == "" or cm.group(2)[0].isupper()):
            credits = int(cm.group(1))
            rest_tok = cm.group(2)
            tail_tokens = ([rest_tok] if rest_tok else []) + tokens[i + 1:]
            areas, remark = _consume_areas(tail_tokens)
            break
        title_tokens.append(tok)
    if credits is None:
        return None  # not a course row

    remark_text = " ".join(remark)
    core_code = None
    cm2 = re.search(r'--\s*CORE\s+(\d{4})\**#?\s*$', remark_text)
    if cm2:
        core_code = f"CORE {cm2.group(1)}"
        remark_text = re.sub(r'--\s*CORE\s+\d{4}\**#?\s*$', '', remark_text).strip()

    return {
        "code": f"{subj} {num}",
        "title": " ".join(title_tokens),
        "credits": credits,
        "areas": areas,
        "remark": remark_text,
        "coreCode": core_code,
    }


def _merge_overlap(a: str, b: str) -> str | None:
    """Merge two fragments of one visual line, e.g. '…Product La' + 'Label 3…'.

    Returns the merged string if b's start overlaps a's end, else None.
    """
    for k in range(min(len(a), len(b)), 1, -1):
        if a[-k:] == b[:k]:
            return a + b[k:]
    return None


def parse_pdf(content: bytes) -> dict[str, dict]:
    """First pass: extract course rows with inline areas (geometry-based)."""
    reader = pypdf.PdfReader(io.BytesIO(content))
    courses: dict[str, dict] = {}

    for page in reader.pages:
        frags: list[tuple[float, float, str]] = []

        def visitor(text, cm, tm, font, size):
            t = text.strip()
            if t:
                frags.append((tm[4], tm[5], t))

        page.extract_text(visitor_text=visitor)

        # Cluster fragments into visual rows by x (rotated table)
        frags.sort(key=lambda f: f[0])
        rows: list[tuple[float, list[tuple[float, str]]]] = []
        for x, y, t in frags:
            if rows and abs(x - rows[-1][0]) < 6:
                rows[-1][1].append((y, t))
            else:
                rows.append((x, [(y, t)]))

        for x, fs in rows:
            fs.sort(key=lambda f: -f[0])  # y descending
            mains = [(y, t) for y, t in fs if CODE_RE.match(t)]
            if not mains:
                continue

            # Merge main-line fragments split mid-line (overlap-join).
            main_y = mains[0][0]
            main_band = [t for y, t in fs
                         if CODE_RE.match(t) or abs(y - main_y) < 3]
            merged = None
            for t in main_band:
                if merged is None:
                    merged = t
                    continue
                m2 = _merge_overlap(merged, t) or _merge_overlap(t, merged)
                merged = m2 if m2 else merged + " " + t
            course = _parse_main(merged) if merged else None
            if course is None:
                # fall back to the longest main fragment
                course = _parse_main(max(mains, key=lambda p: len(p[1]))[1])
            if course is None:
                continue

            # Title-wrap band (fragments at the same x, below the main line)
            for y, t in fs:
                if y > 750 and t != merged and not CODE_RE.match(t):
                    if t not in course["title"] and t not in course["remark"]:
                        course["title"] += " " + t

            courses[course["code"]] = course

    return courses


# ─────────────────────────────────────────────────────────────────────────
# Hand-verified area-cell assignments from the active-list PDF, for courses
# WCQ no longer lists (delisted or designation-expired).  Each entry was
# cross-checked against the per-year course catalogs and the CORE-prefix
# lists; remarks quote the PDF's area-cell text.
# ─────────────────────────────────────────────────────────────────────────
CURATED_CELLS: dict[str, dict] = {
    # Delisted: designation valid until 2024-25 Summer (PDF cell).
    "CIVL 1220": {
        "areas": ["T"],
        "areaByCohort": {"cc22": ["T"], "cc25": [], "cc26": []},
        "remark": "Area T valid until 2024-25 Summer.",
    },
    # PDF cell: 'A, H' (HUMA 1660 @293.0, HUMA 2660 via Fall 2022-23 list).
    "HUMA 1660": {
        "areas": ["A", "H"],
        "areaByCohort": {"cc22": ["A", "H"], "cc25": ["A", "H"], "cc26": ["A", "H"]},
    },
    "HUMA 2660": {
        "areas": ["A", "H"],
        "areaByCohort": {"cc22": ["A", "H"], "cc25": ["A", "H"], "cc26": ["A", "H"]},
    },
    # PDF cell: 'A, H' + 'C-Comm until 2024-25 Summer.'
    "HUMA 2640": {
        "areas": ["A", "H", "C-Comm"],
        "areaByCohort": {"cc22": ["A", "H", "C-Comm"], "cc25": ["A", "H"], "cc26": ["A", "H"]},
        "remark": "C-Comm until 2024-25 Summer.",
    },
    # PDF cell: 'SUS From 2025-26 Fall for 2025-26 and 2026-27 cohorts.'
    "SUST 1010": {
        "areas": ["SUS"],
        "areaByCohort": {"cc22": [], "cc25": ["SUS"], "cc26": ["SUS"]},
        "remark": "SUS from 2025-26 Fall.",
    },
    # PDF cell: 'S From 2024-25 Spring to 2024-25 Summer. SUS From 2025-26
    # Fall for 2025-26 and 2026-27 cohorts.'
    "SUST 1020": {
        "areas": ["S", "SUS"],
        "areaByCohort": {"cc22": ["S"], "cc25": ["SUS"], "cc26": ["SUS"]},
        "remark": "S from 2024-25 Spring to 2024-25 Summer; SUS from 2025-26 Fall.",
    },
    # PDF cell: 'T, SA From 2022-23 Spring to 2024-25 Summer. SUS From
    # 2025-26 Fall for 2025-26 and 2026-27 cohorts.'  Formerly ENVR 1040
    # (same course, code changed in 2025-26).
    "SUST 1030": {
        "areas": ["T", "SA", "SUS"],
        "areaByCohort": {"cc22": ["T", "SA"], "cc25": ["SUS"], "cc26": ["SUS"]},
        "remark": "T, SA from 2022-23 Spring to 2024-25 Summer; SUS from 2025-26 Fall. Formerly ENVR 1040.",
        "prev": "ENVR 1040",
    },
    # PDF cell: 'SA From 2024-25 Spring to 2024-25 Summer.'  CC designation
    # expired after 2024-25 Summer (course not in any WCQ CC page 2520+).
    "SUST 1101": {
        "areas": ["SA"],
        "areaByCohort": {"cc22": ["SA"], "cc25": [], "cc26": []},
        "remark": "SA from 2024-25 Spring to 2024-25 Summer; CC designation expired.",
    },
    # LANG 1401 (Intensive English for University Studies): the first
    # E-Comm course for students needing extra preparation.  Not in WCQ
    # terms 2520-2610 nor the active PDF; E-Comm per the 30-credit rules.
    "LANG 1401": {
        "areas": ["E-Comm"],
        "areaByCohort": {"cc22": ["E-Comm"], "cc25": ["E-Comm"], "cc26": ["E-Comm"]},
        "remark": "Intensive English course; counts toward E-Comm.",
    },
    # ENVR 2050/2060/2070: not offered in any WCQ-scraped term; PDF cells
    # give SA (2050/2060) and T (2070) with SUS from 2025-26 Fall.
    # CORE 2943 (= ENVR 2060) confirmed as SA on the Spring 2022-23 list.
    "ENVR 2050": {
        "areas": ["SA", "SUS"],
        "areaByCohort": {"cc22": ["SA"], "cc25": ["SUS"], "cc26": ["SUS"]},
        "remark": "SUS from 2025-26 Fall.",
    },
    "ENVR 2060": {
        "areas": ["SA", "SUS"],
        "areaByCohort": {"cc22": ["SA"], "cc25": ["SUS"], "cc26": ["SUS"]},
        "remark": "SUS from 2025-26 Fall.",
    },
    "ENVR 2070": {
        "areas": ["T", "SUS"],
        "areaByCohort": {"cc22": ["T"], "cc25": ["SUS"], "cc26": ["SUS"]},
        "remark": "SUS from 2025-26 Fall.",
    },
}

# Core-prefix equivalents for 2022-23 records (CORE xxxx -> new code).
# WCQ 'prev' fields are used when present; this covers the rest.
CORE_TO_CODE: dict[str, str] = {
    "CORE 2944": "SUST 1020",  # per Fall 2022-23 CORE list
}


def main():
    print(f"Loading WCQ areas from {WCQ_PATH}")
    wcq = json.loads(WCQ_PATH.read_text(encoding="utf-8"))
    print(f"  {len(wcq)} courses with WCQ data")

    print(f"Fetching {URL}")
    pdf_bytes = None
    for attempt in range(3):
        try:
            resp = requests.get(URL, timeout=(30, 120),
                                headers={"User-Agent": "CoursePlanner/1.0"})
            resp.raise_for_status()
            pdf_bytes = resp.content
            break
        except requests.RequestException as e:
            print(f"  attempt {attempt + 1} failed: {e}")
    if pdf_bytes is None:
        raise SystemExit("Could not download the CC course list PDF.")
    pdf_courses = parse_pdf(pdf_bytes)
    print(f"  {len(pdf_courses)} courses parsed from PDF")

    merged: dict[str, dict] = {}

    for code, p in pdf_courses.items():
        if code in wcq:
            w = wcq[code]
            cc22, cc25, cc26 = sorted(set(w["cc22"])), sorted(set(w["cc25"])), sorted(set(w["cc26"]))
            union = sorted(set(cc22) | set(cc25) | set(cc26))
            merged[code] = {
                "code": code,
                # WCQ titles are cleaner than the PDF's (wrapped/clipped)
                "title": w["title"],
                "credits": w["units"],
                "areas": union or p["areas"],  # WCQ authoritative; fall back to inline
                "areaByCohort": {"cc22": cc22, "cc25": cc25, "cc26": cc26},
                "remark": p["remark"],
                "coreCode": p["coreCode"] or (w["prev"] if w["prev"].startswith("CORE ") else None),
                "prev": w["prev"] or None,
            }
        elif code in CURATED_CELLS:
            c = CURATED_CELLS[code]
            merged[code] = {
                "code": code,
                "title": p["title"],
                "credits": p["credits"],
                "areas": c["areas"],
                "areaByCohort": c["areaByCohort"],
                "remark": (p["remark"] + " " + c.get("remark", "")).strip(),
                "coreCode": p["coreCode"],
                "prev": c.get("prev"),
            }
        else:
            # Not in WCQ and not curated: inline areas only.  Split into
            # per-cohort lists using the CC program rules — SUS and HAIC
            # did not exist for cc22 (admitted 2022-24); HAIC only exists
            # for cc26 (admitted from 2026), which replaced CTDL.
            areas = sorted(set(p["areas"]))
            merged[code] = {
                "code": code,
                "title": p["title"],
                "credits": p["credits"],
                "areas": areas,
                "areaByCohort": {
                    "cc22": [a for a in areas if a not in ("SUS", "HAIC")],
                    "cc25": [a for a in areas if a != "HAIC"],
                    "cc26": [a for a in areas if a != "CTDL"],
                },
                "remark": p["remark"],
                "coreCode": p["coreCode"],
                "prev": None,
            }

    # Curated-only courses (e.g. LANG 1401): in neither the PDF nor WCQ.
    # Title/credits come from the course catalog.
    catalog = {}
    catalog_path = ROOT / "data" / "all_courses.json"
    if catalog_path.exists():
        for c in json.loads(catalog_path.read_text(encoding="utf-8")):
            catalog[c["code"].upper()] = c

    for code, c in CURATED_CELLS.items():
        if code in merged:
            continue
        cat = catalog.get(code, {})
        merged[code] = {
            "code": code,
            "title": cat.get("title", code),
            "credits": cat.get("credits", 3),
            "areas": c["areas"],
            "areaByCohort": c["areaByCohort"],
            "remark": c.get("remark", ""),
            "coreCode": None,
            "prev": c.get("prev"),
        }

    # WCQ-only courses (offered 2520-2610 but absent from the active PDF)
    wcq_only = 0
    for code, w in wcq.items():
        if code not in merged:
            wcq_only += 1
            merged[code] = {
                "code": code,
                "title": w["title"],
                "credits": w["units"],
                "areas": sorted(set(w["cc22"]) | set(w["cc25"]) | set(w["cc26"])),
                "areaByCohort": {
                    "cc22": sorted(set(w["cc22"])),
                    "cc25": sorted(set(w["cc25"])),
                    "cc26": sorted(set(w["cc26"])),
                },
                "remark": "",
                "coreCode": w["prev"] if w["prev"].startswith("CORE ") else None,
                "prev": w["prev"] or None,
            }

    courses = sorted(merged.values(), key=lambda c: c["code"])

    empty = [c["code"] for c in courses if not c["areas"]]
    print(f"\nTotal {len(courses)} courses ({wcq_only} WCQ-only)")
    print(f"PDF courses with NO area assignment ({len(empty)}):", empty)

    area_counts: dict[str, int] = {}
    for c in courses:
        for a in c["areas"]:
            area_counts[a] = area_counts.get(a, 0) + 1
    print("Area counts (union across cohorts):", area_counts)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(courses, f, ensure_ascii=False, indent=2)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
