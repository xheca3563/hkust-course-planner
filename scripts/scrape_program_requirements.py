#!/usr/bin/env python3
"""Parse HKUST program requirement PDFs into structured JSON templates.

Downloads PDFs from ugadmin.hkust.edu.hk (e.g. 24-25dsct.pdf) and parses the
requirement course lists into JSON templates for the progress engine.

Usage:
  python3 scripts/scrape_program_requirements.py --code DSCT --intake 2024-25
  python3 scripts/scrape_program_requirements.py --all --years 2024-25
"""

import argparse
import io
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
import pypdf
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

CATALOG = "202627"  # current catalog year on ugadmin
PDF_BASE = f"https://ugadmin.hkust.edu.hk/prog_crs/ug/{CATALOG}/pdf"

OUTPUT_DIR = Path("data/programs")

# Section headers seen in the PDFs
SECTION_PREREQ = "Major Pre-requisite course(s)"
SECTION_REQUIRED = ("Required Course(s)", "Engineering Fundamental Course(s)")
# Some PDFs write the electives header across lines as
# "Elective Course(s) Minimum / credit(s) / required"
SECTION_ELECTIVE = ("Elective(s)", "Elective Course(s) Minimum")
SECTION_SCHOOL = "School Requirements"

# Track study markers: programs like MATH/PHYS split requirements into
# tracks (choose-one) or options (optional add-ons). Everything after these
# markers until the next track header belongs to the current track.
TRACK_STUDY_MARKER = "Track Study"
OPTIONS_MARKER = "Option(s)"
OTHER_MARKER = "Other(s)"
TRACK_HEADER_RE = re.compile(r'^(.{2,60}) (Track|Option)$')

# School-level requirement PDFs, keyed by the school name seen in program
# PDFs. Fetched as {short_intake}{slug}_requirements.pdf.
SCHOOL_REQ_PDFS = {
    "Science": "ssci",
    "Business and Management": "sbm",
}

# Joint-school programs: valid schools for the profile dropdown.
JOINT_SCHOOLS = {
    "DSCT": ["Science", "Engineering"],
    "RMBI": ["Business and Management", "Science"],
}

# "CODE 3-4 Note: EXPR" — subject may be "MATH/COMP", credits "3-4".
# "Note:" may be glued to the credits ("3-4Note:") in some PDFs.
REQ_LINE_RE = re.compile(
    r'^([A-Z&]+\s*(?:/[A-Z]+)*)\s+(\d+(?:-\d+)?)\s*Note:\s*(.+)$'
)
# Requirement head WITHOUT a "Note:" keyword, e.g.
# "SENG 3-4 Engineering Introduction course (COMP students may also use"
# Credits are capped at 3 digits per part so 4-digit course numbers
# ("COMP 1021 3 …") are never mistaken for credit counts.
REQ_HEAD_NO_NOTE_RE = re.compile(
    r'^([A-Z&]+\s*(?:/[A-Z]+)*)\s+(\d{1,3}(?:-\d{1,3})?)\s+(.+)$'
)
# "CODE 4211 3 Machine Learning" — number may have letter/H/** suffix
COURSE_LINE_RE = re.compile(
    r'^([A-Z]{2,5})\s+(\d{4}[A-Z]?H?)\**\s+(\d+(?:-\d+)?)\s+(.+)$'
)
# Elective group head: "COMP 15 COMP Electives (…)" or "MATH/COMP/ELEC 9-12Data …"
ELECTIVE_HEAD_RE = re.compile(
    r'^([A-Z&]+\s*(?:/[A-Z]+)*)\s+(\d+(?:-\d+)?)\s*(.+)$'
)
# Line that continues a wrapped note: bare course number "4981H"
NOTE_CONTINUATION_RE = re.compile(r'^\d{4}[A-Z]?H?\**$')

# Page header/footer lines that repeat on every PDF page
PAGE_HEADER_RE = re.compile(r'^School of [A-Za-z &]+ - .+$')
PAGE_FOOTER_RE = re.compile(r'^\d{4}-\d{2} [A-Z]+ \(\dY\) \(\d{4}-\d{2} intake\) Page \d+$')

# Course codes inside note expressions
TOKEN_RE = re.compile(r'[A-Z]+\s+\d{4}[A-Z]?H?\**|[()\[\]]|AND|OR')


def parse_note_expr(expr: str) -> dict | None:
    """Parse a 'Note:' expression into a logic tree, or None if no AND/OR.

    '(COMP 2011 AND COMP 2012) OR COMP 2012H' →
      {'type': 'or', 'children': [
         {'type': 'and', 'children': [
            {'type': 'course', 'code': 'COMP 2011'},
            {'type': 'course', 'code': 'COMP 2012'}]},
         {'type': 'course', 'code': 'COMP 2012H'}]}
    """
    if 'AND' not in expr and 'OR' not in expr:
        return None  # caller treats options list as OR

    tokens = re.findall(TOKEN_RE, expr)
    # Strip ** from course tokens
    tokens = [t[:-2] if t.endswith('**') else t for t in tokens]
    pos = 0

    def parse_group():
        nonlocal pos
        items = []
        while pos < len(tokens):
            tok = tokens[pos]
            if tok in (')', ']'):
                pos += 1
                break
            if tok in ('(', '['):
                pos += 1
                items.append(parse_group())
            elif tok == 'AND' or tok == 'OR':
                items.append(tok)
                pos += 1
            else:
                items.append({"type": "course", "code": tok})
                pos += 1
        return combine_logic(items)

    def combine_logic(items):
        if len(items) == 1:
            return items[0]
        # AND binds tighter: merge AND chains first
        merged = []
        i = 0
        while i < len(items):
            if isinstance(items[i], str):  # stray operator
                i += 1
                continue
            if i + 1 < len(items) and items[i + 1] == 'AND':
                children = [items[i]]
                j = i + 1
                while j < len(items) and items[j] == 'AND':
                    if j + 1 < len(items):
                        children.append(items[j + 1])
                    j += 2
                merged.append({"type": "and", "children": children})
                i = j
            else:
                merged.append(items[i])
                i += 1
        if len(merged) == 1:
            return merged[0]
        return {"type": "or", "children": merged}

    root_items = []
    while pos < len(tokens):
        tok = tokens[pos]
        if tok in ('(', '['):
            pos += 1
            root_items.append(parse_group())
        elif tok == 'AND' or tok == 'OR':
            root_items.append(tok)
            pos += 1
        else:
            root_items.append({"type": "course", "code": tok})
            pos += 1
    return combine_logic(root_items)


def match_elective_head(text: str) -> tuple[str, str, str] | None:
    """Match an elective group head, distinguishing it from course lines.

    Group heads look like "COMP 15 COMP Electives (…)" or
    "MATH/COMP/ELEC 9-12Data Science Electives […]".  Course lines
    ("COMP 4634 3 Cybersecurity") are rejected because the 4-digit
    course number is not a valid credit count.
    Returns (subject, credits, label) or None.
    """
    m = re.match(r'^([A-Z&]+\s*(?:/[A-Z]+)*)\s+(\d+(?:-\d+)?)(.*)$', text)
    if not m:
        return None
    subject, credits, rest = m.groups()
    # Reject 4-digit "credits" — those are course numbers, not credit counts
    # (covers both "COMP 4981H …" wrap-around lines and course lines)
    if len(credits) >= 3 and not re.match(r'^\d+-\d+$', credits):
        return None
    label = rest.strip()
    if len(label) < 8:
        return None
    return subject, credits, label


def parse_course_line(line: str) -> dict | None:
    """Parse 'MATH 2121 4 Linear Algebra' → course dict."""
    m = COURSE_LINE_RE.match(line.strip())
    if not m:
        return None
    subject, number, credits, title = m.groups()
    return {
        "code": f"{subject} {number}",
        "credits": int(credits.split("-")[0]),
        "title": title.strip(),
    }


def is_pure_expression(note: str) -> bool:
    """True if the note is ONLY course codes + AND/OR/parens (a selection
    expression).  Explanatory notes contain regular words (lowercase)."""
    stripped = re.sub(r'[A-Z]+\s+\d{4}[A-Z]?H?\**', '', note)
    stripped = re.sub(r'[()\[\]ANDOR\s]', '', stripped)
    return stripped == ''


def parse_pdf_text(text: str) -> dict:
    """Parse full PDF text into structured requirement data."""
    lines = [l.strip() for l in text.split('\n')]

    result = {
        "prerequisites": [],
        "required": [],
        "schoolRequirements": [],
        "electives": [],
        "notes": "",
        "tracks": [],  # only populated for programs with track/option study
    }

    # Cut remarks section off
    remark_idx = next(
        (i for i, l in enumerate(lines) if l.startswith("**Remarks")), None
    )
    if remark_idx is not None:
        result["notes"] = "\n".join(lines[remark_idx + 1:])
        body_lines = lines[:remark_idx]
    else:
        body_lines = lines

    section = None
    pending_note = None  # requirement whose options are being collected
    pending_note_section = None
    current_elective = None
    current_area = None
    pending_head = ""  # buffer for split group heads
    req_head = ""  # buffer for split requirement heads ("CHEM/LIFS/" + "PHYS")
    track_mode = False  # True after "Track Study" / "Option(s)"
    current_track = None  # track whose groups are being collected

    def commit_req(req, sec):
        if sec == SECTION_PREREQ:
            result["prerequisites"].append(req)
        elif sec == "Engineering Fundamental Course(s)":
            # SENG school-level requirements, embedded in each program PDF
            result["schoolRequirements"].append(req)
        elif sec in SECTION_REQUIRED:
            if track_mode and current_track is not None:
                current_track["groups"].append(req)
            else:
                result["required"].append(req)
        elif sec == SECTION_SCHOOL:
            result["schoolRequirements"].append(req)

    for line in body_lines:
        if not line:
            continue

        # Track/option study markers
        if line == TRACK_STUDY_MARKER or line == OPTIONS_MARKER:
            track_mode = True
            current_track = None
            section = None
            pending_note = None
            pending_note_section = None
            current_elective = None
            current_area = None
            pending_head = ""
            req_head = ""
            continue

        # "Other(s)" subsections carry prose belonging to the current track
        if track_mode and line == OTHER_MARKER:
            section = None
            continue

        # Track header: "Applied Mathematics Track", "Honors Physics Option"
        # (the uppercase guard rejects prose that merely ends in "Track")
        if track_mode and line[0].isupper() and TRACK_HEADER_RE.match(line):
            current_track = {"name": line, "note": "", "groups": [], "electives": []}
            result["tracks"].append(current_track)
            section = None
            pending_note = None
            pending_note_section = None
            current_elective = None
            current_area = None
            pending_head = ""
            req_head = ""
            continue

        # Section headers
        if line == SECTION_PREREQ or line in SECTION_REQUIRED \
                or line in SECTION_ELECTIVE or line == SECTION_SCHOOL:
            section = line
            pending_note = None
            pending_note_section = None
            current_elective = None
            current_area = None
            pending_head = ""
            req_head = ""
            continue

        if section is None:
            # Prose between a track header and its first section ("Students
            # in the IRE Track should also take …") belongs to the track note.
            if track_mode and current_track is not None \
                    and not PAGE_HEADER_RE.match(line) \
                    and not PAGE_FOOTER_RE.match(line):
                current_track["note"] = (
                    current_track["note"] + " " + line).strip()
            continue

        # ── Electives section ──
        if section in SECTION_ELECTIVE:
            # 1) Course inside current area
            if current_area is not None:
                c = parse_course_line(line)
                if c:
                    current_area["courses"].append(c)
                    continue
                current_area = None  # area ended; fall through

            # 2) Area header: "COMP/ELEC courses", "MATH courses", "… Area"
            if current_elective is not None and (
                line == "Courses Without Associated Area"
                or line.endswith("Area")
                or re.match(r'^[A-Z&/ ]+ courses$', line)
            ):
                current_area = {"label": line, "courses": []}
                current_elective["areas"].append(current_area)
                continue

            # 3) Group head (single line or split across lines)
            hm = match_elective_head(line)
            if hm is None and (line.endswith("/") or (line.isupper() and len(line) <= 8)):
                pending_head = (pending_head + line) if pending_head.endswith("/") \
                    else (pending_head + " " + line if pending_head else line)
                hm = match_elective_head(pending_head)
                if hm is not None:
                    pending_head = ""
                elif not pending_head.endswith("/") and not pending_head.isupper():
                    pass  # keep buffering split heads only
            elif hm is None and pending_head and re.match(r'^\d+(?:-\d+)?[A-Z]', line):
                hm = match_elective_head(pending_head + " " + line)
                if hm is not None:
                    pending_head = ""

            if hm is not None:
                subject, credits, label = hm
                credit_range = credits.split("-")
                current_elective = {
                    "subject": subject,
                    "minCredits": int(credit_range[0]),
                    "maxCredits": int(credit_range[1]) if len(credit_range) > 1 else None,
                    "freeForm": label,
                    "areas": [],
                }
                if track_mode and current_track is not None:
                    current_track["electives"].append(current_elective)
                else:
                    result["electives"].append(current_elective)
                current_area = None
                continue

            # 4) Wrapped label continuation — append to freeForm
            if current_elective is not None:
                if not PAGE_HEADER_RE.match(line) and not PAGE_FOOTER_RE.match(line):
                    current_elective["freeForm"] += " " + line
                continue
            continue

        # ── SSCI Science Foundation courses (no credit count on the head) ──
        # "SSCI Science Foundation courses [8 courses from the specified
        # elective list …]" — all following course lines are options.
        if line.startswith("SSCI Science Foundation"):
            pending_note = {
                "subject": "SSCI",
                "minCredits": 24,
                "maxCredits": None,
                "note": (line + " [8 courses: 7 lecture courses incl. 1-3 from "
                         "each of CHEM/LIFS/OCES/MATH/DASC/PHYS, plus 1 lab]"),
                "logic": None,
                "options": [],
            }
            pending_note_section = section
            commit_req(pending_note, section)
            continue

        # ── Split requirement head combine: "CHEM/LIFS/" + "PHYS" + "3-4Note: …" ──
        # Must run BEFORE the note-continuation rules: while a head is buffered,
        # the following lines belong to the new requirement, not the old note.
        if req_head:
            m_head = re.match(r'^\d+(?:-\d+)?Note:\s*(.*)', line)
            if m_head:
                line = req_head + " " + line
                req_head = ""
            elif re.match(r'^\d{4}[A-Z]?H?\**\s', line):
                # wrapped course line: "COMP" + "4981H 3 Honors …"
                line = req_head + " " + line
                req_head = ""

        # ── Continuation of a wrapped note: bare course number ("4981H") ──
        if pending_note is not None and NOTE_CONTINUATION_RE.match(line):
            if re.search(r'[A-Z]+$', pending_note["note"]):
                pending_note["note"] += " " + line
                pending_note["logic"] = parse_note_expr(pending_note["note"])
            continue

        # ── Requirement line with note: "MATH 4 Note: MATH 2121 OR MATH 2131" ──
        m = REQ_LINE_RE.match(line)
        if m:
            subject, credits, note = m.groups()
            credit_range = credits.split("-")
            logic = parse_note_expr(note)
            pending_note = {
                "subject": subject,
                "minCredits": int(credit_range[0]),
                "maxCredits": int(credit_range[1]) if len(credit_range) > 1
                else int(credit_range[0]),
                "note": note,
                "logic": logic,
                "options": [],
            }
            pending_note_section = section
            commit_req(pending_note, section)
            continue

        # ── Requirement head without "Note:" keyword ──
        # e.g. "SENG 3-4 Engineering Introduction course (COMP students may…"
        m = REQ_HEAD_NO_NOTE_RE.match(line)
        if m:
            subject, credits, note = m.groups()
            credit_range = credits.split("-")
            pending_note = {
                "subject": subject,
                "minCredits": int(credit_range[0]),
                "maxCredits": int(credit_range[1]) if len(credit_range) > 1
                else int(credit_range[0]),
                "note": note,
                "logic": parse_note_expr(note),
                "options": [],
            }
            pending_note_section = section
            commit_req(pending_note, section)
            continue

        # ── Continuation of a wrapped note: expression fragment ──
        # e.g. "(MATH 1014 OR MATH 1024)] OR [MATH 1020]" after a truncated line
        # (skip lines that are complete requirement heads themselves)
        if (pending_note is not None and not REQ_LINE_RE.match(line)
                and not REQ_HEAD_NO_NOTE_RE.match(line)
                and re.search(r'[()\[\]]|AND|OR', line)
                and re.search(r'[A-Z]+\s+\d{4}', line)):
            pending_note["note"] += " " + line
            pending_note["logic"] = parse_note_expr(pending_note["note"])
            continue

        # ── Split requirement head buffering: "CHEM/LIFS/" + "PHYS" ──
        if line.endswith("/") or (line.isupper() and len(line) <= 8):
            req_head = (req_head + line) if req_head.endswith("/") \
                else (req_head + " " + line if req_head else line)
            continue

        # ── Simple course line: "COMP 2611 4 Computer Organization" ──
        c = parse_course_line(line)
        if c:
            if pending_note is not None and (
                not is_pure_expression(pending_note["note"])
                or c["code"] in pending_note["note"]
            ):
                # Option of the current note group:
                # - pure expressions: only codes mentioned in the note
                # - explanatory notes: ALL following course lines
                pending_note["options"].append(c)
                continue
            # Standalone course — finalize pending note, start new requirement
            pending_note = None
            pending_note_section = None
            req = {
                "subject": c["code"].split()[0],
                "minCredits": c["credits"],
                "maxCredits": c["credits"],
                "note": "",
                "logic": None,
                "options": [c],
            }
            commit_req(req, section)
            continue

    # Post-process: tracks
    if result["tracks"]:
        # "Students should follow one of the tracks" → choose-one; otherwise
        # the tracks/options are optional add-ons on top of the common
        # requirements (e.g. PHYS). With no track selected, only the common
        # requirements apply.
        result["trackRequired"] = bool(
            re.search(r'follow one of the tracks', text, re.I))
        # Convert each track's elective groups into requirement groups
        for track in result["tracks"]:
            for el in track.pop("electives", []):
                track["groups"].append({
                    "subject": el["subject"],
                    "minCredits": el["minCredits"],
                    "maxCredits": el["maxCredits"],
                    "note": el["freeForm"],
                    "logic": None,
                    "options": [c for area in el.get("areas", [])
                                for c in area["courses"]],
                })
    return result


_SESSION = requests.Session()
_SESSION.headers["User-Agent"] = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
_retry = Retry(total=2, backoff_factor=0.5, status_forcelist=[500, 502, 503, 504])
_SESSION.mount("https://", HTTPAdapter(max_retries=_retry))

# Cache of parsed school-requirement PDFs, keyed by (short_intake, slug)
_SCHOOL_REQ_CACHE: dict[tuple[str, str], list | None] = {}
_SCHOOL_REQ_LOCK = threading.Lock()


def parse_school_pdf_text(text: str) -> list:
    """Parse a school-requirement PDF (SSCI/SBM) into requirement groups.

    These PDFs use a simple table: [subject] [code] [title/note] [credits].
    ugadmin serves two layouts — canonical ("COMP 1021 3 Introduction to
    Computer Science") and columnar, where credits trail the line
    ("ACCT 2010 Principles of Accounting I 3") and tokens are glued
    ("3-4Note:", "3Calculus").  Both are normalized here.
    """
    lines = [l.strip() for l in text.split("\n")]
    remark_idx = next(
        (i for i, l in enumerate(lines) if l.startswith("**Remarks")), None)
    if remark_idx is not None:
        lines = lines[:remark_idx]

    def split_credits(s: str) -> tuple[int, int]:
        lo, _, hi = s.partition("-")
        return int(lo), int(hi) if hi else int(lo)

    def new_group(subject, credits, note, logic=None, options=None,
                  no_prose=False):
        lo, hi = split_credits(credits)
        return {"subject": subject, "minCredits": lo, "maxCredits": hi,
                "note": note, "logic": logic, "options": options or [],
                "noProse": no_prose}

    groups = []
    cur = None  # note group currently collecting options

    def add_course(c):
        nonlocal cur
        if cur is not None and (
                not re.search(r"\b(AND|OR)\b", cur["note"])
                or c["code"] in cur["note"]):
            cur["options"].append(c)
            return
        # The current note is a closed expression the course is not part of
        # (e.g. "ECON 3 Note: ECON 2123 OR ECON 3123" followed by a FINA
        # course) — the course starts its own standalone requirement.
        cur = None
        groups.append(new_group(c["code"].split()[0], str(c["credits"]),
                                "", None, [c]))

    for raw in lines:
        # Columnar extraction glues tokens ("3-4Note:", "3Calculus",
        # "ORCOMP", "ANDMARK") and pads cells with wide whitespace runs
        # ("SSCI   Science Foundation").
        s = raw
        s = re.sub(r"\b(AND|OR)([A-Z])", r"\1 \2", s)
        s = re.sub(r"(\d{1,3})([A-Z][a-z])", r"\1 \2", s)
        s = re.sub(r"\s+", " ", s).strip()
        if not s or PAGE_HEADER_RE.match(s) or PAGE_FOOTER_RE.match(s):
            continue

        # SSCI Science Foundation: open group, all courses below.
        # The head states the course count ("[8 courses", "[6 courses");
        # assume 3 credits each (24cr for the 8-course years).
        if s.startswith("SSCI Science Foundation"):
            n = re.search(r"\[(\d+) courses", s)
            cur = new_group("SSCI", str(int(n.group(1)) * 3) if n else "24",
                            s, None, no_prose=True)
            groups.append(cur)
            continue

        # Note head, columnar: "ECON Note: ECON 2103 OR ECON 2113 3"
        m = re.match(
            r"^([A-Z&]+(?:\s*/\s*[A-Z]+)*)\s+Note:\s*(.*?)\s+(\d+(?:-\d+)?)$",
            s)
        if m:
            subject, note, credits = m.groups()
            cur = new_group(subject, credits, note, parse_note_expr(note))
            groups.append(cur)
            continue

        # Note head, canonical: "ECON 3 Note: ECON 2103 OR ECON 2113"
        m = re.match(
            r"^([A-Z&]+(?:\s*/\s*[A-Z]+)*)\s+(\d+(?:-\d+)?)\s*Note:\s*(.+)$",
            s)
        if m:
            subject, credits, note = m.groups()
            cur = new_group(subject, credits, note, parse_note_expr(note))
            groups.append(cur)
            continue

        # Course, columnar: "ACCT 2010 Principles of Accounting I 3"
        m = re.match(
            r"^([A-Z&]+(?:\s*/\s*[A-Z]+)*)\s+(\d{4}[A-Z]?H?\**)\s+(.+?)\s+(\d{1,2})$",
            s)
        if m:
            subject, number, title, credits = m.groups()
            add_course({"code": f"{subject} {number.rstrip('*')}",
                        "credits": int(credits.split("-")[0]),
                        "title": title})
            continue

        # Course, reversed column order: "COMP Introduction to…1021 3"
        m = re.match(
            r"^([A-Z&]+(?:\s*/\s*[A-Z]+)*)\s+(.+?)(\d{4}[A-Z]?H?\**)\s+(\d{1,2})$",
            s)
        if m:
            subject, title, number, credits = m.groups()
            add_course({"code": f"{subject} {number.rstrip('*')}",
                        "credits": int(credits.split("-")[0]),
                        "title": title})
            continue

        # Course, canonical: "COMP 1021 3 Introduction to Computer Science"
        c = parse_course_line(s)
        if c:
            add_course(c)
            continue

        # Head without "Note:": "SSCI 6 Additional Science …"
        m = re.match(
            r"^([A-Z&]+(?:\s*/\s*[A-Z]+)*)\s+(\d{1,3}(?:-\d{1,3})?)\s+(.+)$",
            s)
        if m:
            subject, credits, note = m.groups()
            cur = new_group(subject, credits, note, parse_note_expr(note))
            groups.append(cur)
            continue

        # Prose: continuation of the current group's note
        if cur is not None and not cur.get("noProse"):
            cur["note"] = (cur["note"] + " " + s).strip()
            cur["logic"] = parse_note_expr(cur["note"])
    return groups


def fetch_school_requirements(school: str, intake: str) -> list | None:
    """Fetch and parse a school-requirement PDF (cached per intake)."""
    slug = SCHOOL_REQ_PDFS.get(school)
    if not slug:
        return None
    short_intake = intake[2:] if intake.startswith("20") else intake
    key = (short_intake, slug)
    with _SCHOOL_REQ_LOCK:
        if key in _SCHOOL_REQ_CACHE:
            return _SCHOOL_REQ_CACHE[key]

    url = f"{PDF_BASE}/{short_intake}{slug}_requirements.pdf"
    reqs = None
    try:
        # ugadmin intermittently returns 404 for valid files; retry a few
        # times with a short pause before giving up.
        resp = None
        for _ in range(3):
            resp = _SESSION.get(url, timeout=(30, 120))
            if resp.status_code == 200:
                break
            time.sleep(2)
        if resp is not None and resp.status_code == 200:
            # Try both extraction modes — some PDF vintages only come out
            # cleanly in one of them — and keep the richer parse.
            reqs = []
            for mode in ("plain", "layout"):
                reader = pypdf.PdfReader(io.BytesIO(resp.content))
                text = "\n".join(p.extract_text(extraction_mode=mode)
                                 or "" for p in reader.pages)
                parsed = parse_school_pdf_text(text)
                if len(parsed) > len(reqs):
                    reqs = parsed
            # IRE-track-only groups get a distinct subject label
            reqs = [
                {**g, "subject": "SSCI（仅 IRE 方向）"}
                if "IRE Track" in g.get("note", "") else g
                for g in reqs
            ]
        else:
            print(f"  school req {slug} {intake}: HTTP {resp.status_code}")
    except Exception as e:
        print(f"  school req {slug} {intake}: fetch error ({e})")

    with _SCHOOL_REQ_LOCK:
        _SCHOOL_REQ_CACHE[key] = reqs
    return reqs


def scrape_program(code: str, intake: str) -> dict | None:
    """Download and parse one program PDF."""
    # Filename uses short year prefix: "2024-25" → "24-25dsct.pdf"
    short_intake = intake[2:] if intake.startswith("20") else intake
    url = f"{PDF_BASE}/{short_intake.lower()}{code.lower()}.pdf"
    try:
        resp = _SESSION.get(url, timeout=(30, 120))
    except Exception as e:
        print(f"  {code} {intake}: fetch error ({e})")
        return None
    if resp.status_code != 200:
        print(f"  {code} {intake}: HTTP {resp.status_code} — SKIP")
        return None

    try:
        reader = pypdf.PdfReader(io.BytesIO(resp.content))
        full_text = "\n".join(p.extract_text() or "" for p in reader.pages)
    except Exception as e:
        print(f"  {code} {intake}: PDF parse error ({e})")
        return None

    lines = [l.strip() for l in full_text.split('\n') if l.strip()]
    program_name = lines[0] if lines else f"{code} program"
    school = ""
    m = re.search(r'School of ([A-Za-z &]+)', full_text[:1000])
    if m:
        school = m.group(1).strip()

    parsed = parse_pdf_text(full_text)

    # Joint-school programs: valid schools for the profile dropdown
    if code.upper() in JOINT_SCHOOLS:
        parsed["schools"] = JOINT_SCHOOLS[code.upper()]

    # School requirements: joint programs are exempt; others must complete
    # their school's requirement PDF (SENG's are embedded in the program PDF
    # under "Engineering Fundamental Course(s)" and already in `parsed`).
    if re.search(r'exempted from the\s+School Requirements', full_text, re.I):
        parsed["schoolRequirementsExempt"] = True
        parsed["schoolRequirements"] = []
    elif school in SCHOOL_REQ_PDFS:
        school_reqs = fetch_school_requirements(school, intake)
        if school_reqs:
            # BSc majors of SBM are not required to take the SB&M 12 group
            if program_name.startswith("BSc"):
                school_reqs = [g for g in school_reqs
                               if g["subject"] != "SB&M"]
            parsed["schoolRequirements"] = school_reqs

    template = {
        "programCode": code.upper(),
        "programName": program_name,
        "intakeYear": intake,
        "school": school,
        **parsed,
    }
    return template


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--code", type=str, help="Program code (e.g. DSCT)")
    parser.add_argument("--intake", type=str, help="Intake year (e.g. 2024-25)")
    parser.add_argument("--all", action="store_true", help="Scrape all programs")
    parser.add_argument("--years", type=str,
                        default="2022-23,2023-24,2024-25,2025-26,2026-27",
                        help="Comma-separated intake years for --all")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.all:
        sys.path.insert(0, str(Path("scripts")))
        from scrape_programs import get_program_list
        programs = get_program_list()
        print(f"Programs ({len(programs)}): {programs}")
        years = args.years.split(",")
        pairs = [(code, year) for code in programs for year in years]
        print(f"Total PDFs to fetch: {len(pairs)}")
        ok = fail = 0
        with ThreadPoolExecutor(max_workers=4) as ex:
            futs = {ex.submit(scrape_program, code, year): (code, year)
                    for code, year in pairs}
            for fut in as_completed(futs):
                code, year = futs[fut]
                try:
                    template = fut.result()
                except Exception as e:
                    print(f"  {code} {year}: ERROR ({e})", flush=True)
                    fail += 1
                    continue
                if template:
                    out = OUTPUT_DIR / f"{code.upper()}_{year}.json"
                    with open(out, "w", encoding="utf-8") as f:
                        json.dump(template, f, ensure_ascii=False, indent=2)
                    ok += 1
                else:
                    fail += 1
        print(f"\nDone: {ok} templates, {fail} failed")
    elif args.code and args.intake:
        template = scrape_program(args.code, args.intake)
        if template:
            out = OUTPUT_DIR / f"{args.code.upper()}_{args.intake}.json"
            with open(out, "w", encoding="utf-8") as f:
                json.dump(template, f, ensure_ascii=False, indent=2)
            print(json.dumps(template, indent=2, ensure_ascii=False))
            print(f"\nWritten to {out}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
