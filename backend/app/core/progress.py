"""Graduation requirement tracking engine.

Computes progress toward a degree using:
  - Program requirement templates (data/programs/{CODE}_{YYYY-YY}.json)
  - The 30-credit Common Core course -> area mapping
    (data/common_core_courses.json, per-admission-cohort areas)
  - The 5-year course catalog for credit lookup (data/all_courses.json)

Common Core rules (30-credit program, per admission cohort; UCE):

  cc22 (admitted 2022-23 .. 2024-25):
    Foundations:  E-Comm 6cr (advanced E-Comm counts toward the 30cr
                  total), C-Comm 3cr, HMW 0cr (mandatory); CTDL 3cr
                  (elective — substitutable by E-Comm/C-Comm/A/H/S/T/SA/UxOP)
    Broadening:   12cr outside the home area(s): 3cr in 4 different
                  non-home areas (single-home), or 3cr in EACH non-home
                  area + the remaining 3cr from any area (joint-school
                  union rule, e.g. DSCT: 3×A/H/SA + 3 any).  Credits
                  beyond the 12cr floor (up to 18cr) substitute the
                  CTDL/UxOP electives.
    Experiencing: UXOP 3cr (elective — substitutable by CTDL/E-Comm/
                  C-Comm/broadening areas)
  cc25 (admitted 2025-26): as cc22, plus SUS in the Broadening areas.
  cc26 (admitted from 2026-27): as cc25, but HAIC (AI literacy) replaces
    CTDL in Foundations.

Home common core areas by program (per UCE):
  Science -> S; Engineering -> T (BIEN/CEEV/CENG -> S,T; COSC -> T);
  Business -> SA; SHSS -> SA (GCS -> H,SA); AIS: EVMT -> SA, ISDN/IDT -> T.
  Joint-school programs take the UNION of their schools' home areas
  (DSCT SSCI+SENG -> S,T; RMBI SSCI+SBM -> S,SA).
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent.parent  # project root
PROGRAMS_DIR = ROOT / "data" / "programs"
CC_PATH = ROOT / "data" / "common_core_courses.json"
CATALOG_PATH = ROOT / "data" / "all_courses.json"

TOTAL_CREDITS_REQUIRED = 120

# Admission cohort per intake year
COHORTS = {
    "2022-23": "cc22", "2023-24": "cc22", "2024-25": "cc22",
    "2025-26": "cc25",
}

# Broadening areas and the Foundations literacy area per cohort
COHORT_AREAS = {
    "cc22": {"broadening": ["A", "H", "S", "T", "SA"], "literacy": "CTDL"},
    "cc25": {"broadening": ["A", "H", "S", "T", "SA", "SUS"], "literacy": "CTDL"},
    "cc26": {"broadening": ["A", "H", "S", "T", "SA", "SUS"], "literacy": "HAIC"},
}

# Capstone-dependent elective rules (DSCT): the requirement depends on the
# capstone course taken — (min courses, min credits, min COMP/ELEC courses).
# The official note also requires 1-2 MATH courses within the minimum set;
# extra electives roll to free electives, so satisfaction checks whether
# SOME subset of the completed electives fits the mix.
CAPSTONE_ELECTIVE_RULES = {
    "MATH 4995": (4, 12, 2),      # thesis option
    "COMP 4910": (3, 9, 1),       # co-op / FYP options
    "COMP 4981": (3, 9, 1),
    "COMP 4981H": (3, 9, 1),
}

# Fallback home areas for programs whose template lacks the school field
HOME_AREAS_BY_CODE = {
    "IIM": [], "IDT": ["T"], "EVMT": ["SA"], "ISDN": ["T"], "CHEM": ["S"],
}

# Programs with special home areas (overrides the school default)
HOME_AREAS_BY_CODE.update({
    "BIEN": ["S", "T"], "CEEV": ["S", "T"], "CENG": ["S", "T"],
    "COSC": ["T"], "GCS": ["H", "SA"],
    "DSCT": ["S", "T"], "RMBI": ["S", "SA"],
})


def cohort_for(admit_year: str) -> str:
    """Map an admission year to a Common Core cohort."""
    return COHORTS.get(admit_year, "cc26")


def home_areas_for(program_code: str, school: str) -> list[str]:
    """Home common core areas for a program."""
    if program_code in HOME_AREAS_BY_CODE:
        return HOME_AREAS_BY_CODE[program_code]
    s = (school or "").lower()
    if "science" in s:
        return ["S"]
    if "engineering" in s:
        return ["T"]
    if "business" in s:
        return ["SA"]
    if "humanities" in s or "social science" in s:
        return ["SA"]
    return []


def _is_ire_track(name: str | None) -> bool:
    """True for the International Research Enrichment (IRE) track/option.

    The track name is "International Research Enrichment Track" — it does not
    contain the literal "IRE", so match "Enrichment" as well.
    """
    return bool(name) and ("IRE" in name or "Enrichment" in name)


class GraduationProgressEngine:
    """Calculates graduation progress for a program + admission cohort."""

    def __init__(self):
        self._cc: dict[str, dict] = {}
        self._cc_alias: dict[str, str] = {}
        self._catalog: dict[str, dict] = {}
        self._template_credits: dict[str, int] = {}
        self._templates: dict[str, dict[str, dict]] = {}  # code -> year -> template
        self._load_data()

    # ── data loading ────────────────────────────────────────────────────

    def _load_data(self):
        if CC_PATH.exists():
            raw = json.loads(CC_PATH.read_text(encoding="utf-8"))
            for c in raw:
                self._cc[c["code"].upper()] = c
                for alias in (c.get("prev"), c.get("coreCode")):
                    if alias:
                        self._cc_alias[alias.upper()] = c["code"].upper()
        if CATALOG_PATH.exists():
            for c in json.loads(CATALOG_PATH.read_text(encoding="utf-8")):
                self._catalog[c["code"].upper()] = c
        if PROGRAMS_DIR.exists():
            for f in PROGRAMS_DIR.glob("*.json"):
                m = re.match(r"^(.+)_(\d{4}-\d{2})\.json$", f.name)
                if not m:
                    continue
                code, year = m.group(1), m.group(2)
                try:
                    t = json.loads(f.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, OSError):
                    continue
                self._templates.setdefault(code, {})[year] = t
                # Index option credits as a fallback for courses missing
                # from the scraped catalogs (e.g. very new courses).
                for lst in ("required", "schoolRequirements"):
                    for g in t.get(lst, []) or []:
                        for o in g.get("options", []) or []:
                            self._template_credits.setdefault(
                                o["code"].upper(), o.get("credits", 0))
                for g in t.get("electives", []) or []:
                    for a in g.get("areas", []) or []:
                        for o in a.get("courses", []) or []:
                            self._template_credits.setdefault(
                                o["code"].upper(), o.get("credits", 0))
                for tr in t.get("tracks", []) or []:
                    for g in tr.get("groups", []) or []:
                        for o in g.get("options", []) or []:
                            self._template_credits.setdefault(
                                o["code"].upper(), o.get("credits", 0))

    # ── helpers ─────────────────────────────────────────────────────────

    def credits_of(self, code: str) -> int | None:
        """Credit count for a course code, from catalog or CC mapping."""
        code = code.upper()
        c = self._catalog.get(code)
        if c:
            return c.get("credits")
        cc = self._cc.get(code) or self._cc.get(self._cc_alias.get(code, ""))
        if cc:
            return cc.get("credits")
        if code in self._template_credits:
            return self._template_credits[code]
        return None

    def resolve_cc(self, code: str) -> dict | None:
        """Resolve a completed course code to its CC mapping entry."""
        code = code.upper()
        return self._cc.get(code) or self._cc.get(self._cc_alias.get(code, ""))

    def load_template(self, program_code: str, admit_year: str) -> dict | None:
        """Load the template for a program, preferring the exact intake
        year and falling back to the closest available year."""
        by_year = self._templates.get(program_code)
        if not by_year:
            return None
        if admit_year in by_year:
            return by_year[admit_year]
        # Prefer later years (newest catalog) then earlier
        years = sorted(by_year.keys(), reverse=True)
        for y in years:
            if y > admit_year:
                return by_year[y]
        return by_year[years[0]]

    def list_programs(self) -> list[dict]:
        """All program templates: code, name, available years."""
        out = []
        for code, by_year in sorted(self._templates.items()):
            years = sorted(by_year.keys())
            latest = by_year.get(years[-1], {})
            out.append({
                "code": code,
                "name": latest.get("programName", code),
                "school": latest.get("school", ""),
                "years": years,
                "tracks": [t.get("name", "") for t in latest.get("tracks", [])],
                "trackRequired": bool(latest.get("trackRequired")),
                "schools": latest.get("schools", []),
                "schoolRequirementsExempt": bool(
                    latest.get("schoolRequirementsExempt")),
            })
        return out

    # ── common core ─────────────────────────────────────────────────────

    def _calc_common_core(self, completed: list[str], cohort: str,
                          home: list[str]) -> dict:
        """Allocate completed CC courses to CC buckets (greedy, in order).

        Bucket priority per course: E-Comm, C-Comm, literacy (CTDL/HAIC),
        non-home area below its 3cr minimum, UXOP, non-home area below the
        12cr total, any other area (home or overflow), then overflow.
        """
        areas = COHORT_AREAS[cohort]["broadening"]
        literacy = COHORT_AREAS[cohort]["literacy"]
        home_set = set(home)
        non_home = [a for a in areas if a not in home_set]

        buckets = {
            "hmw": [], "eComm": [], "cComm": [], "literacy": [], "uxop": [],
            "area": {a: [] for a in areas},
        }
        cred = {"hmw": 0, "eComm": 0, "cComm": 0, "literacy": 0, "uxop": 0,
                "area": {a: 0 for a in areas}}

        for code in completed:
            cc = self.resolve_cc(code)
            if not cc:
                continue
            course_areas = cc.get("areaByCohort", {}).get(cohort) or cc.get("areas") or []
            if not course_areas:
                continue
            c = cc.get("credits") or self.credits_of(code) or 0

            # HMW is a 0-credit mandatory module, tracked as a checkbox
            if "HMW" in course_areas:
                buckets["hmw"].append(code)
                cred["hmw"] += 1
                continue

            def area_total(a):
                return cred["area"][a]

            non_home_total = sum(area_total(a) for a in non_home)
            pick = None
            if "E-Comm" in course_areas:
                # Count advanced E-Comm beyond the 6cr floor too — it
                # substitutes CTDL/UXOP and counts toward the 30cr total.
                pick = ("eComm", "eComm")
            elif "C-Comm" in course_areas:
                pick = ("cComm", "cComm")
            elif literacy in course_areas and cred["literacy"] < 3:
                pick = ("literacy", "literacy")
            elif "UXOP" in course_areas and cred["uxop"] < 3:
                pick = ("uxop", "uxop")
            else:
                # Broadening: prefer non-home areas below their 3cr min
                for a in course_areas:
                    if a in non_home and area_total(a) < 3:
                        pick = ("area", a)
                        break
                if pick is None:
                    # then any non-home area while below the 12cr total
                    for a in course_areas:
                        if a in non_home and non_home_total < 12:
                            pick = ("area", a)
                            break
                if pick is None:
                    # then any area (up to 18cr broadening) else overflow
                    for a in course_areas:
                        pick = ("area", a)
                        break
            if pick is None:
                continue

            kind, key = pick
            if kind == "area":
                buckets["area"][key].append(code)
                cred["area"][key] += c
            else:
                buckets[kind].append(code)
                cred[kind] += c

        # Report per-area rows
        area_rows = []
        for a in areas:
            total = cred["area"][a]
            is_home = a in home_set
            required = 0 if is_home else 3
            area_rows.append({
                "area": a,
                "home": is_home,
                "required": required,
                "completed": total,
                "satisfied": is_home or total >= 3,
                "courses": buckets["area"][a],
            })

        # Broadening floor (UCE): 12 credits with 3cr in each of the
        # required non-home areas.  Single-home programs need 3cr in 4
        # different non-home areas; joint-school programs (union of home
        # areas) need 3cr in EVERY non-home area, and the remaining
        # credits of the 12cr floor may come from any area (home or not).
        non_home_total = sum(cred["area"][a] for a in non_home)
        areas_ge3 = sum(1 for a in non_home if cred["area"][a] >= 3)
        non_home_min = areas_ge3 >= min(4, len(non_home))
        allowance = max(0, 12 - 3 * len(non_home))
        area_total = sum(cred["area"].values())
        floor_ok = non_home_min and area_total >= 12
        floor_rem = min(allowance, max(0, area_total - (12 - allowance)))

        # Credits beyond the floor substitute the CTDL/UXOP electives
        # (UCE: E-Comm/C-Comm/broadening-area courses may substitute
        # CTDL and UXOP).  One substitute credit fills one slot — CTDL
        # first, then UXOP.
        substitutes = (max(0, cred["eComm"] - 6)
                       + max(0, cred["cComm"] - 3)
                       + max(0, area_total - 12))
        literacy_need = max(0, 3 - cred["literacy"])
        uxop_need = max(0, 3 - cred["uxop"])
        literacy_ok = cred["literacy"] >= 3 or substitutes >= 3
        uxop_ok = cred["uxop"] >= 3 or substitutes >= literacy_need + uxop_need

        total_cc = (cred["eComm"] + cred["cComm"] + cred["literacy"]
                    + cred["uxop"] + area_total)

        satisfied = (
            bool(buckets["hmw"]) and cred["eComm"] >= 6 and cred["cComm"] >= 3
            and floor_ok and total_cc >= 30
        )

        return {
            "required": 30,
            "completed": min(total_cc, 30),
            "satisfied": satisfied,
            "cohort": cohort,
            "homeAreas": home,
            "components": {
                "hmw": {
                    "required": 0, "completed": 1 if buckets["hmw"] else 0,
                    "satisfied": bool(buckets["hmw"]),
                    "courses": buckets["hmw"],
                },
                "eComm": {
                    "required": 6, "completed": cred["eComm"],
                    "satisfied": cred["eComm"] >= 6,
                    "courses": buckets["eComm"],
                },
                "cComm": {
                    "required": 3, "completed": cred["cComm"],
                    "satisfied": cred["cComm"] >= 3,
                    "courses": buckets["cComm"],
                },
                "literacy": {
                    "label": literacy,
                    "required": 3, "completed": cred["literacy"],
                    "satisfied": literacy_ok,
                    "substitutable": True,
                    "substituted": cred["literacy"] < 3 and substitutes >= 3,
                    "substituteCredits": min(3, substitutes),
                    "courses": buckets["literacy"],
                },
                "broadening": {
                    "areas": area_rows,
                    "nonHomeTotal": {
                        "required": 12 - allowance,
                        "completed": non_home_total,
                        "satisfied": non_home_total >= 12 - allowance,
                    },
                    "nonHomeAreasMet": non_home_min,
                    "floorRemainder": {
                        "required": allowance,
                        "completed": floor_rem,
                        "satisfied": floor_ok,
                    },
                    "extraCredits": max(0, area_total - 12),
                },
                "uxop": {
                    "required": 3, "completed": cred["uxop"],
                    "satisfied": uxop_ok,
                    "substitutable": True,
                    "substituted": (cred["uxop"] < 3
                                    and substitutes >= literacy_need + uxop_need),
                    "substituteCredits": min(3, max(0, substitutes - literacy_need)),
                    "courses": buckets["uxop"],
                },
            },
        }

    # ── program requirement groups ──────────────────────────────────────

    @staticmethod
    def _eval_logic(node: dict, completed: set[str]) -> bool:
        t = node.get("type")
        if t == "course":
            return node.get("code", "").upper() in completed
        if t == "and":
            return all(GraduationProgressEngine._eval_logic(c, completed)
                       for c in node.get("children", []))
        if t == "or":
            return any(GraduationProgressEngine._eval_logic(c, completed)
                       for c in node.get("children", []))
        return False

    def _eval_group(self, group: dict, completed: set[str]) -> dict:
        """Evaluate one requirement group; returns a report row."""
        opts = group.get("options", [])
        done = [o for o in opts if o["code"].upper() in completed]
        done_credits = sum(
            self.credits_of(o["code"]) or o.get("credits", 0) for o in done)

        logic = group.get("logic")
        if logic:
            satisfied = self._eval_logic(logic, completed)
        elif group.get("minCredits", 0) <= 0:
            satisfied = bool(done)  # 0-credit groups need course completion
        else:
            satisfied = done_credits >= group["minCredits"]

        return {
            "subject": group.get("subject", ""),
            "note": group.get("note", ""),
            "minCredits": group.get("minCredits", 0),
            "maxCredits": group.get("maxCredits", 0),
            "satisfied": satisfied,
            "completed": done,
            "missing": [o for o in opts if o["code"].upper() not in completed],
        }

    def _calc_program_requirements(self, template: dict,
                                   completed: set[str],
                                   track: str | None = None,
                                   warnings: list[str] | None = None) -> dict:
        tracks = template.get("tracks") or []
        track_required = bool(template.get("trackRequired"))
        selected_track = None
        if tracks and track:
            selected_track = next(
                (t for t in tracks if t.get("name") == track), None)
            if selected_track is None and warnings is not None:
                warnings.append(
                    f"Track \"{track}\" not found in the program template; "
                    "track requirements are not counted.")
        elif tracks and track_required and warnings is not None:
            warnings.append(
                "This program requires choosing a track; pick one in your "
                "profile to see its requirements.")
        # (Optional add-on tracks: no selection → no extra groups)

        ire = _is_ire_track(
            selected_track.get("name", "") if selected_track else None)

        groups = []
        for g in template.get("schoolRequirements", []) or []:
            # SSCI school groups marked IRE-only apply only to IRE-track
            # students (non-IRE students skip them).
            if g.get("subject") == "SSCI（仅 IRE 方向）" and not ire:
                continue
            row = self._eval_group(g, completed)
            row["category"] = "school"
            groups.append(row)
        for g in template.get("required", []) or []:
            row = self._eval_group(g, completed)
            row["category"] = "major"
            groups.append(row)
        if selected_track is not None:
            for g in selected_track.get("groups", []) or []:
                row = self._eval_group(g, completed)
                row["category"] = "track"
                groups.append(row)
        return {
            "groups": groups,
            "satisfied": all(g["satisfied"] for g in groups) if groups else None,
            "track": selected_track.get("name") if selected_track else None,
            "tracks": [t.get("name", "") for t in tracks],
            "trackRequired": track_required,
        }

    def _calc_electives(self, template: dict, completed: set[str]) -> list[dict]:
        rows = []
        for g in template.get("electives", []) or []:
            seen: set[str] = set()
            comp_elec: set[str] = set()
            math_codes: set[str] = set()
            for area in g.get("areas", []) or []:
                label = area.get("label", "")
                for c in area.get("courses", []) or []:
                    code = c["code"].upper()
                    seen.add(code)
                    if label.startswith("COMP/ELEC"):
                        comp_elec.add(code)
                    elif label.startswith("MATH"):
                        math_codes.add(code)
            done = [c for c in seen if c in completed]
            done_credits = sum(self.credits_of(c) or 3 for c in done)

            row = {
                "subject": g.get("subject", ""),
                "minCredits": g.get("minCredits", 0),
                "maxCredits": g.get("maxCredits", 0),
                "freeForm": g.get("freeForm", ""),
                "completed": done_credits,
                "satisfied": done_credits >= g.get("minCredits", 0),
                "courses": sorted(done),
                "options": sorted(seen),
            }
            # DSCT-style conditional electives: the requirement depends on
            # the capstone taken (MATH 4995 thesis vs COMP 4910/4981/4981H).
            if comp_elec and math_codes and "MATH 4995" in g.get("freeForm", ""):
                cap = next(
                    (c for c in CAPSTONE_ELECTIVE_RULES if c in completed),
                    "COMP 4910")  # project options are the default minimum
                min_courses, min_credits, min_comp = CAPSTONE_ELECTIVE_RULES[cap]
                comp_n = len(set(done) & comp_elec)
                math_n = len(set(done) & math_codes)
                # Pick m ∈ {1, 2} MATH courses within the minimum set:
                # need min_courses - m COMP/ELEC courses to fill the rest.
                mix_ok = any(
                    m <= math_n and (min_courses - m) <= comp_n for m in (1, 2))
                cap_label = ("MATH 4995" if cap == "MATH 4995"
                             else "COMP 4910/4981/4981H")
                row["satisfied"] = (
                    len(done) >= min_courses and done_credits >= min_credits
                    and comp_n >= min_comp and mix_ok)
                row["branch"] = cap_label
                row["detail"] = (
                    f"按 {cap_label} 方向：需 {min_courses} 门"
                    f"（{min_credits} 学分），其中 COMP/ELEC ≥{min_comp}、"
                    f"MATH 1-2 门；当前 COMP/ELEC {comp_n} 门、MATH {math_n} 门")
            rows.append(row)
        return rows

    # ── main entry point ────────────────────────────────────────────────

    def calculate(self, program_code: str, admit_year: str,
                  completed: list[str], selected: list[str] | None = None,
                  track: str | None = None) -> dict:
        """Full graduation progress report."""
        completed = [c.strip().upper() for c in completed if c.strip()]
        selected = [c.strip().upper() for c in (selected or []) if c.strip()]
        completed_set = set(completed)
        warnings: list[str] = []

        template = self.load_template(program_code, admit_year)
        if template is None:
            raise ValueError(
                f"No requirement template found for program {program_code}")

        if template.get("intakeYear") != admit_year:
            warnings.append(
                f"No template for {admit_year}; using {template.get('intakeYear')} "
                f"requirements instead.")

        school = template.get("school", "")
        home = home_areas_for(program_code, school)
        if not home:
            warnings.append(
                "Home Common Core area unknown for this program; all broadening "
                "areas are treated as non-home.")

        cohort = cohort_for(admit_year)
        cc = self._calc_common_core(completed, cohort, home)
        prog = self._calc_program_requirements(template, completed_set,
                                               track, warnings)
        electives = self._calc_electives(template, completed_set)

        # Free electives: credits not consumed by CC or program groups
        cc_codes: set[str] = set()
        for comp in cc["components"].values():
            if isinstance(comp, dict):
                cc_codes.update(comp.get("courses", []))
        for row in cc["components"]["broadening"]["areas"]:
            cc_codes.update(row["courses"])

        program_codes: set[str] = set()
        for g in prog["groups"]:
            program_codes.update(o["code"].upper() for o in g["completed"])
            program_codes.update(o["code"].upper() for o in g["missing"])
        for e in electives:
            program_codes.update(e["options"])

        unmatched: list[str] = []
        total_completed = 0
        consumed_codes: set[str] = set()
        for code in completed:
            cr = self.credits_of(code)
            if cr is None:
                if not self.resolve_cc(code):
                    unmatched.append(code)
                continue
            total_completed += cr
            if code in cc_codes or code in program_codes:
                consumed_codes.add(code)
        free_completed = sum(
            self.credits_of(c) or 0 for c in completed
            if c not in consumed_codes)

        required_credits = sum(
            max(0, g.get("minCredits", 0)) for g in template.get("required", []) or [])
        track_credits = sum(
            max(0, g.get("minCredits", 0))
            for g in prog["groups"] if g["category"] == "track")
        # School requirement credits count toward the 120-credit total only
        # when they are NOT also major requirements (SSCI/SBM school courses
        # are allowed to double-count with the major).
        major_opts: set[str] = set()
        for g in (template.get("required", []) or []):
            major_opts.update(
                o["code"].upper() for o in g.get("options", []) or [])
        for g in (template.get("prerequisites", []) or []):
            major_opts.update(
                o["code"].upper() for o in g.get("options", []) or [])
        ire = _is_ire_track(prog.get("track"))
        school_extra = 0
        for g in template.get("schoolRequirements", []) or []:
            if g.get("subject") == "SSCI（仅 IRE 方向）" and not ire:
                continue
            opts = {o["code"].upper() for o in g.get("options", []) or []}
            if not opts or opts.isdisjoint(major_opts):
                school_extra += max(0, g.get("minCredits", 0))
        elective_credits = sum(
            max(0, g.get("minCredits", 0))
            for g in template.get("electives", []) or [])
        free_required = max(
            0, TOTAL_CREDITS_REQUIRED - 30 - required_credits - track_credits
            - school_extra - elective_credits)

        total_with_planned = total_completed + sum(
            self.credits_of(c) or 0 for c in selected if c not in completed_set)

        grad_ready = (
            cc["satisfied"]
            and (prog["satisfied"] is True)
            and all(e["satisfied"] for e in electives)
            and total_completed >= TOTAL_CREDITS_REQUIRED
        )

        return {
            "program": {
                "code": program_code,
                "name": template.get("programName", program_code),
                "admitYear": admit_year,
                "templateYear": template.get("intakeYear"),
                "school": school,
                "cohort": cohort,
                "homeAreas": home,
            },
            "commonCore": cc,
            "programRequirements": prog,
            "electives": electives,
            "freeElectives": {
                "required": free_required,
                "completed": free_completed,
                "satisfied": free_completed >= free_required,
            },
            "summary": {
                "totalRequired": TOTAL_CREDITS_REQUIRED,
                "totalCompleted": total_completed,
                "totalWithPlanned": total_with_planned,
                "remaining": max(0, TOTAL_CREDITS_REQUIRED - total_completed),
                "graduationReady": grad_ready,
            },
            "unmatchedCompleted": unmatched,
            "warnings": warnings,
        }
