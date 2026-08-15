#!/usr/bin/env python3
"""Scrape HKUST undergraduate program catalog from prog-crs.hkust.edu.hk/ugprog.

Extracts all major and minor programs for each intake year.
Usage: python3 scrape_programs.py
Output: frontend/src/data/programs.ts
"""

import re
import json
import sys
import urllib.request
from html.parser import HTMLParser
from typing import NamedTuple


class Program(NamedTuple):
    code: str        # e.g. "COMP", "MINOR-CHEM", "EXTM-AI"
    name: str        # e.g. "BEng in Computer Science"
    school: str      # e.g. "School of Engineering"
    dept: str        # e.g. "Computer Science and Engineering"
    prog_type: str   # "major", "minor", "extended_major", "school_req"


class ProgramParser(HTMLParser):
    """Parse the calalog-program-wrapper section of the page."""

    def __init__(self):
        super().__init__()
        self.programs: list[Program] = []
        self._in_program = False
        self._in_wrapper = False
        self._current_school = ""
        self._current_dept = ""
        self._current_code = ""
        self._current_name = ""
        self._tag_stack: list[str] = []
        self._field: str = ""  # which field are we capturing?

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        self._tag_stack.append(tag)
        attr_dict = dict(attrs)

        if tag == "div" and "calalog-program-wrapper" in (attr_dict.get("class") or ""):
            self._in_wrapper = True

        if not self._in_wrapper:
            return

        if tag == "div" and "school-title" in (attr_dict.get("class") or ""):
            self._current_school = ""
            self._field = "school"

        if tag == "li" and "program" in (attr_dict.get("class") or ""):
            self._in_program = True
            self._current_dept = ""
            self._current_code = ""
            self._current_name = ""

        if self._in_program:
            if tag == "div" and "program-school" in (attr_dict.get("class") or ""):
                self._field = "dept"
            elif tag == "div" and "program-name" in (attr_dict.get("class") or ""):
                self._field = "code"
            elif tag == "div" and "program-degree" in (attr_dict.get("class") or ""):
                self._field = "name"

    def handle_endtag(self, tag: str):
        if self._tag_stack:
            self._tag_stack.pop()

        if tag == "div" and self._field:
            self._field = ""

        if tag == "li" and self._in_program:
            self._in_program = False
            if self._current_code:
                prog_type = "major"
                code = self._current_code.strip()
                if code.startswith("MINOR-"):
                    prog_type = "minor"
                    code = code[6:]  # strip MINOR- prefix
                elif code.startswith("EXTM-"):
                    prog_type = "extended_major"
                elif code.startswith("SREQ-"):
                    prog_type = "school_req"

                # Clean HTML entities from name
                name = self._current_name.strip()
                name = name.replace("&amp;", "&")

                # Clean BR tags from dept
                dept = self._current_dept.strip()
                dept = re.sub(r'<[Bb][Rr]\s*/?\s*>', ', ', dept)

                self.programs.append(Program(
                    code=code,
                    name=name,
                    school=self._current_school.strip(),
                    dept=dept,
                    prog_type=prog_type,
                ))

    def handle_data(self, data: str):
        if not self._in_wrapper:
            return
        text = data.strip()
        if not text:
            return

        if self._field == "school":
            self._current_school += " " + text
        elif self._field == "dept":
            self._current_dept += data  # keep raw including BR tags
        elif self._field == "code":
            self._current_code += text
        elif self._field == "name":
            self._current_name += data  # keep raw


def fetch_programs(year: str) -> list[Program]:
    """Fetch and parse programs for a given intake year."""
    url = f"https://prog-crs.hkust.edu.hk/ugprog/{year}/"
    print(f"  Fetching {url}...")
    req = urllib.request.Request(url, headers={"User-Agent": "CoursePlanner/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        html = resp.read().decode("utf-8")

    parser = ProgramParser()
    parser.feed(html)
    return parser.programs


def organize_by_year(all_data: dict[str, list[Program]]):
    """Organize programs by year and generate the TypeScript output."""

    lines = []
    lines.append('/**')
    lines.append(' * HKUST Undergraduate Major and Minor Programs')
    lines.append(' *')
    lines.append(' * AUTO-GENERATED from https://prog-crs.hkust.edu.hk/ugprog')
    lines.append(' * Source: official HKUST Program & Course Catalog')
    lines.append(' *')
    lines.append(' * DO NOT EDIT MANUALLY — regenerate with:')
    lines.append(' *   python3 scripts/scrape_programs.py')
    lines.append(' */')
    lines.append('')
    lines.append('export interface ProgramInfo {')
    lines.append('  code: string')
    lines.append('  name: string')
    lines.append('}')
    lines.append('')
    lines.append('export interface SchoolPrograms {')
    lines.append('  schoolCode: string')
    lines.append('  schoolName: string')
    lines.append('  majors: ProgramInfo[]')
    lines.append('}')
    lines.append('')
    lines.append('export interface YearPrograms {')
    lines.append('  year: string')
    lines.append('  schools: SchoolPrograms[]')
    lines.append('  minors: ProgramInfo[]')
    lines.append('  extendedMajors: ProgramInfo[]')
    lines.append('}')
    lines.append('')

    # Build year data
    year_data: dict[str, dict] = {}
    for year, programs in sorted(all_data.items()):
        # Group by school
        schools: dict[str, dict] = {}  # school_name -> {majors: [], minors: [], extended: []}
        all_minors: list[Program] = []
        all_extended: list[Program] = []

        for p in programs:
            if p.prog_type == "school_req":
                continue
            elif p.prog_type == "minor":
                all_minors.append(p)
            elif p.prog_type == "extended_major":
                all_extended.append(p)
            else:  # major
                school_name = p.school
                if school_name not in schools:
                    schools[school_name] = {"majors": [], "school_name": school_name}
                # Deduplicate by code within school
                existing = [m.code for m in schools[school_name]["majors"]]
                if p.code not in existing:
                    schools[school_name]["majors"].append(p)

        # Map school names to codes
        SCHOOL_MAP = {
            "School of Science": "SSCI",
            "School of Engineering": "SENG",
            "School of Business and Management": "SBM",
            "School of Humanities and Social Science": "SHSS",
            "Academy of Interdisciplinary Studies": "AIS",
            "Joint-School Program(s)": "JOINT",
        }

        school_list = []
        for school_name, data in sorted(schools.items()):
            sc = SCHOOL_MAP.get(school_name, school_name[:4].upper())
            school_list.append({
                "schoolCode": sc,
                "schoolName": school_name,
                "majors": sorted(data["majors"], key=lambda p: p.code),
            })

        # Deduplicate minors
        seen_minors = set()
        unique_minors = []
        for p in all_minors:
            if p.code not in seen_minors:
                seen_minors.add(p.code)
                unique_minors.append(p)

        # Deduplicate extended majors
        seen_ext = set()
        unique_ext = []
        for p in all_extended:
            if p.code not in seen_ext:
                seen_ext.add(p.code)
                unique_ext.append(p)

        year_data[year] = {
            "schools": school_list,
            "minors": sorted(unique_minors, key=lambda p: p.code),
            "extendedMajors": sorted(unique_ext, key=lambda p: p.code),
        }

    # Generate TypeScript
    lines.append('// =============================================================================')
    lines.append('// ALL YEARS DATA')
    lines.append('// =============================================================================')
    lines.append('')
    lines.append('export const ALL_YEARS_PROGRAMS: YearPrograms[] = [')
    for year, data in sorted(year_data.items()):
        lines.append('  {')
        lines.append(f'    year: "{year}",')
        lines.append('    schools: [')
        for sch in data["schools"]:
            lines.append('      {')
            lines.append(f'        schoolCode: "{sch["schoolCode"]}",')
            lines.append(f'        schoolName: "{sch["schoolName"]}",')
            lines.append('        majors: [')
            for m in sch["majors"]:
                name_escaped = m.name.replace('"', '\\"')
                lines.append(f'          {{ code: "{m.code}", name: "{name_escaped}" }},')
            lines.append('        ],')
            lines.append('      },')
        lines.append('    ],')
        lines.append('    minors: [')
        for m in data["minors"]:
            name_escaped = m.name.replace('"', '\\"')
            lines.append(f'      {{ code: "{m.code}", name: "{name_escaped}" }},')
        lines.append('    ],')
        lines.append('    extendedMajors: [')
        for m in data["extendedMajors"]:
            name_escaped = m.name.replace('"', '\\"')
            lines.append(f'      {{ code: "{m.code}", name: "{name_escaped}" }},')
        lines.append('    ],')
        lines.append('  },')
    lines.append('];')
    lines.append('')

    # Helper functions
    lines.append('// =============================================================================')
    lines.append('// HELPER FUNCTIONS')
    lines.append('// =============================================================================')
    lines.append('')
    lines.append('/** Get programs for a specific intake year */')
    lines.append('export function getProgramsForYear(year: string): YearPrograms | undefined {')
    lines.append('  return ALL_YEARS_PROGRAMS.find((p) => p.year === year);')
    lines.append('}')
    lines.append('')
    lines.append('/** Get available intake years */')
    lines.append('export function getAvailableYears(): string[] {')
    lines.append('  return ALL_YEARS_PROGRAMS.map((p) => p.year);')
    lines.append('}')
    lines.append('')
    lines.append('/** Get majors for a school in a given year */')
    lines.append('export function getMajorsForSchool(schoolCode: string | null, year?: string): ProgramInfo[] {')
    lines.append('  if (!schoolCode) return [];')
    lines.append('  const yp = year ? getProgramsForYear(year) : ALL_YEARS_PROGRAMS[ALL_YEARS_PROGRAMS.length - 1];')
    lines.append('  if (!yp) return [];')
    lines.append('  const school = yp.schools.find((s) => s.schoolCode === schoolCode);')
    lines.append('  return school?.majors ?? [];')
    lines.append('}')
    lines.append('')
    lines.append('/** Get minors for a given year */')
    lines.append('export function getMinors(year?: string): ProgramInfo[] {')
    lines.append('  const yp = year ? getProgramsForYear(year) : ALL_YEARS_PROGRAMS[ALL_YEARS_PROGRAMS.length - 1];')
    lines.append('  return yp?.minors ?? [];')
    lines.append('}')
    lines.append('')
    lines.append('/** Get extended majors for a given year */')
    lines.append('export function getExtendedMajors(year?: string): ProgramInfo[] {')
    lines.append('  const yp = year ? getProgramsForYear(year) : ALL_YEARS_PROGRAMS[ALL_YEARS_PROGRAMS.length - 1];')
    lines.append('  return yp?.extendedMajors ?? [];')
    lines.append('}')
    lines.append('')
    lines.append('/** Get latest year available */')
    lines.append('export function getLatestYear(): string {')
    lines.append('  return ALL_YEARS_PROGRAMS[ALL_YEARS_PROGRAMS.length - 1]?.year ?? "2026-27";')
    lines.append('}')
    lines.append('')

    return '\n'.join(lines)


def main():
    years = ["2022-23", "2023-24", "2024-25", "2025-26", "2026-27"]
    all_data: dict[str, list[Program]] = {}

    print("Scraping HKUST Program Catalog...")
    for year in years:
        try:
            programs = fetch_programs(year)
            all_data[year] = programs
            majors = [p for p in programs if p.prog_type == "major"]
            minors = [p for p in programs if p.prog_type == "minor"]
            ext = [p for p in programs if p.prog_type == "extended_major"]
            reqs = [p for p in programs if p.prog_type == "school_req"]
            print(f"  {year}: {len(majors)} majors, {len(minors)} minors, {len(ext)} extended, {len(reqs)} school reqs")
        except Exception as e:
            print(f"  {year}: ERROR - {e}")

    # Generate output
    output = organize_by_year(all_data)

    output_path = "frontend/src/data/programs.ts"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(output)

    print(f"\nGenerated {output_path}")
    print(f"Total: {len(output.splitlines())} lines")


if __name__ == "__main__":
    main()


def get_program_list() -> list[str]:
    """Return unique major program codes across all years (for --all scraping)."""
    codes: set[str] = set()
    for year in ["2022-23", "2023-24", "2024-25", "2025-26", "2026-27"]:
        try:
            programs = fetch_programs(year)
            for p in programs:
                if p.prog_type == "major":
                    codes.add(p.code)
        except Exception as e:
            print(f"  [WARN] {year}: {e}", file=sys.stderr)
    return sorted(codes)
