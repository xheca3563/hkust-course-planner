"""Data scraping utilities for HKUST course information.

Real HKUST Class Schedule & Quota endpoint:
    https://w5.ab.ust.hk/wcq/cgi-bin/{term}/subject/{dept}

Usage:
    python -m app.core.scraper --term "2610" --output data/courses.json
    python -m app.core.scraper --term "2520" --output data/courses.json --schools SENG,SSCI
"""

import asyncio
import json
import re
import sys
import time
from pathlib import Path
from typing import Optional

import httpx
from bs4 import BeautifulSoup

# ── Constants ──────────────────────────────────────────────

# Real class schedule endpoint
BASE_URL = "https://w5.ab.ust.hk/wcq/cgi-bin"

# Department codes to scrape — auto-discovered from class schedule index page
DEPARTMENT_CODES = [
    "ACCT","AESF","AIAA","AISC","AMAT","AMCC","ARIN","BEHI","BIBU","BIEN",
    "BSBE","BTEC","CENG","CHEM","CHMS","CIEM","CIVL","CMAA","COMP","CPEG",
    "CSIT","DASC","DISC","DRAP","DSAA","DSCT","ECON","EEMT","EESM","ELBT",
    "ELEC","EMIA","ENEG","ENGG","ENTR","ENVR","ENVS","EVNG","EVSM","FINA",
    "FOFB","GBUS","GNED","HLTH","HMAW","HUMA","IBTM","IEDA","IIMP","INTR",
    "IPEN","ISDN","ISOM","JEVE","LANG","LIFS","MAED","MAFS","MAIE","MARK",
    "MASS","MATE","MATH","MCEE","MECH","MESF","MFIT","MGCS","MGMT","MICS",
    "MILE","MIMT","MSBD","MSDM","MSPY","MTLE","NANO","OCES","PDEV","PHYS",
    "PPOL","RMBI","ROAS","SBMT","SCIE","SEEN","SHSS","SMMG","SOSC","SUST",
    "TEMG","UGOD","UPOP","UROP","UTOP","WBBA",
]

DEPARTMENT_TO_SCHOOL: dict[str, str] = {
    # SENG
    "AESF": "SENG", "AIAA": "SENG", "AISC": "SENG",
    "CENG": "SENG", "CIEM": "SENG", "CIVL": "SENG", "CMAA": "SENG",
    "COMP": "SENG", "CPEG": "SENG", "CSIT": "SENG",
    "EEMT": "SENG", "EESM": "SENG", "ELBT": "SENG", "ELEC": "SENG",
    "ENEG": "SENG", "ENGG": "SENG", "ENTR": "SENG",
    "EVNG": "SENG", "EVSM": "SENG",
    "IBTM": "SENG", "IEDA": "SENG", "IIMP": "SENG",
    "IPEN": "SENG", "ISDN": "SENG", "ISOM": "SENG",
    "JEVE": "SENG", "MCEE": "SENG", "MECH": "SENG",
    "MESF": "SENG", "MILE": "SENG", "MIMT": "SENG",
    "MTLE": "SENG", "ROAS": "SENG",
    "SEEN": "SENG", "SMMG": "SENG", "TEMG": "SENG",
    # SSCI
    "AMAT": "SSCI", "AMCC": "SSCI",
    "BEHI": "SSCI", "BIEN": "SSCI", "BIBU": "SSCI",
    "BSBE": "SSCI", "BTEC": "SSCI",
    "CHEM": "SSCI", "CHMS": "SSCI",
    "DASC": "SSCI", "DSAA": "SSCI", "DSCT": "SSCI",
    "ENVR": "SSCI", "ENVS": "SSCI",
    "LIFS": "SSCI",
    "MAED": "SSCI", "MAFS": "SSCI", "MAIE": "SSCI",
    "MASS": "SSCI", "MATE": "SSCI", "MATH": "SSCI",
    "MFIT": "SSCI", "MSBD": "SSCI", "MSDM": "SSCI",
    "NANO": "SSCI", "OCES": "SSCI", "PHYS": "SSCI", "SCIE": "SSCI",
    # SBM
    "ACCT": "SBM", "ECON": "SBM", "FINA": "SBM",
    "FOFB": "SBM", "GBUS": "SBM",
    "MARK": "SBM", "MGMT": "SBM", "RMBI": "SBM",
    "SBMT": "SBM", "WBBA": "SBM",
    # SHSS
    "EMIA": "SHSS", "GNED": "SHSS", "HLTH": "SHSS",
    "HMAW": "SHSS", "HUMA": "SHSS",
    "LANG": "SHSS", "MGCS": "SHSS", "PDEV": "SHSS",
    "PPOL": "SHSS", "SHSS": "SHSS", "SOSC": "SHSS",
    "SUST": "SHSS",
    # Others — general university programs
    "ARIN": "", "DISC": "", "DRAP": "", "INTR": "",
    "MICS": "", "MSPY": "", "UGOD": "", "UPOP": "",
    "UROP": "", "UTOP": "",
}

# Day abbreviation mapping
DAY_MAP = {
    "Mo": "Mon", "Tu": "Tue", "We": "Wed",
    "Th": "Thu", "Fr": "Fri", "Sa": "Sat", "Su": "Sun",
}

DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def parse_days(days_str: str) -> list[str]:
    """Parse 'TuTh' or 'MoWeFr' → ['Tue', 'Thu'] etc."""
    result = []
    i = 0
    while i < len(days_str):
        if i + 1 < len(days_str) and days_str[i:i+2] in DAY_MAP:
            result.append(DAY_MAP[days_str[i:i+2]])
            i += 2
        else:
            i += 1
    return result


def parse_time_12h(t: str) -> str:
    """Convert '12:00PM' → '12:00', '03:00PM' → '15:00'."""
    t = t.strip().upper()
    match = re.match(r'(\d{1,2}):(\d{2})(AM|PM)', t)
    if not match:
        return t
    h, m, ampm = int(match.group(1)), match.group(2), match.group(3)
    if ampm == "PM" and h != 12:
        h += 12
    if ampm == "AM" and h == 12:
        h = 0
    return f"{h:02d}:{m}"


def parse_section_type(section_str: str) -> str:
    """Extract section type from 'L1' → 'L', 'T1A' → 'T', 'LA1' → 'LA'."""
    match = re.match(r'([A-Za-z]+)', section_str)
    return match.group(1) if match else section_str


async def scrape_subject(client: httpx.AsyncClient, term: str, dept: str) -> list[dict]:
    """Scrape all courses for a single subject/department."""
    url = f"{BASE_URL}/{term}/subject/{dept}"
    print(f"  [{dept}] Fetching...", end=" ", flush=True)

    try:
        resp = await client.get(url)
        if resp.status_code != 200:
            print(f"HTTP {resp.status_code} — skipping")
            return []
    except Exception as e:
        print(f"Error: {e}")
        return []

    print(f"OK ({len(resp.text)} bytes)")

    soup = BeautifulSoup(resp.text, "lxml")
    courses = []

    for course_div in soup.find_all("div", class_="course"):
        try:
            # Course code + title
            subject_div = course_div.find("div", class_="subject")
            if not subject_div:
                continue
            subject_text = subject_div.get_text(strip=True)
            # "COMP 1021 - Introduction to Computer Science (3 units)"
            match = re.match(r'([A-Z]{2,4}\s+\d{4}[A-Z]?)\s*[-–]\s*(.+?)\s*\((\d+)\s*units?\)', subject_text, re.IGNORECASE)
            if not match:
                # Try simpler pattern
                match = re.match(r'([A-Z]{2,4}\s+\d{4}[A-Z]?)', subject_text)
                if not match:
                    continue
                code = match.group(1).upper()
                title = subject_text[len(match.group(0)):].strip().lstrip("-– ").strip()
                credits = 3
            else:
                code = match.group(1).upper()
                title = match.group(2).strip()
                credits = int(match.group(3))

            # Course attributes (prerequisites, exclusions, description)
            prerequisites = ""
            corequisites = ""
            exclusions = ""
            description = ""
            course_attr = course_div.find("div", class_="courseattr")
            if course_attr:
                attr_table = course_attr.find("table")
                if attr_table:
                    for row in attr_table.find_all("tr"):
                        cells = row.find_all(["th", "td"])
                        if len(cells) >= 2:
                            key = cells[0].get_text(strip=True).upper()
                            val = cells[1].get_text(strip=True)
                            if "PRE-REQUISITE" in key or "PREREQUISITE" in key:
                                prerequisites = val
                            elif "CO-REQUISITE" in key or "COREQUISITE" in key:
                                corequisites = val
                            elif "EXCLUSION" in key:
                                exclusions = val
                            elif "DESCRIPTION" in key:
                                description = val

            # Sections table
            sections = []
            current_section: dict | None = None  # track building section for otherRow additions

            # Regex for day-time ranges (shared between mainRow and otherRow)
            DT_PATTERN = re.compile(
                r'([A-Za-z]+)\s+(\d{1,2}:\d{2}[AP]M)\s*[-–]\s*(\d{1,2}:\d{2}[AP]M)'
            )

            def _parse_time_slots(datetime_str: str, venue: str = "") -> list[dict]:
                """Parse all day-time ranges from a datetime string."""
                slots = []
                for dt_match in DT_PATTERN.finditer(datetime_str):
                    day_part = dt_match.group(1)
                    start_time = parse_time_12h(dt_match.group(2))
                    end_time = parse_time_12h(dt_match.group(3))
                    for d in parse_days(day_part):
                        slots.append({
                            "day": d,
                            "startTime": start_time,
                            "endTime": end_time,
                            "venue": venue,
                        })
                if not slots:
                    # Fallback: match just days without times
                    day_match = re.match(r'([A-Za-z]+)', datetime_str)
                    if day_match:
                        for d in parse_days(day_match.group(1)):
                            slots.append({
                                "day": d,
                                "startTime": "",
                                "endTime": "",
                                "venue": venue,
                            })
                return slots

            sections_table = course_div.find("table", class_="sections")
            if sections_table:
                for row in sections_table.find_all("tr"):
                    classes = row.get("class", [])

                    # Skip mobile-only display rows (they duplicate desktop content)
                    if "mobileInstructorRow" in classes or "mobileViewDetail" in classes:
                        continue

                    cells = row.find_all("td")

                    if "newsect" in classes:
                        # ── new section (mainRow) ──
                        # Save the previous section if any
                        if current_section is not None:
                            sections.append(current_section)
                            current_section = None

                        if len(cells) < 7:
                            continue

                        # Cell 0: "L1 (2225)"
                        section_cell = cells[0].get_text(strip=True)
                        sec_match = re.match(r'([A-Za-z]+\d*\w*)\s*\((\d+)\)', section_cell)
                        if not sec_match:
                            continue
                        section_id = sec_match.group(1)
                        crn = sec_match.group(2)
                        sec_type = parse_section_type(section_id)

                        # Cell 1: main time slot(s)
                        datetime_str = cells[1].get_text(strip=True)

                        # Cell 2: Room — determined now, venue filled after
                        room = cells[2].get_text(strip=True)
                        room = re.sub(r'\s*\(\d+\)', '', room).strip()

                        time_slots = _parse_time_slots(datetime_str, venue=room)

                        # Cell 3: Instructor
                        instructor = cells[3].get_text(strip=True) if len(cells) > 3 else ""

                        # Cells 5-6: Quota, Enrol
                        quota = int(cells[5].get_text(strip=True)) if len(cells) > 5 and cells[5].get_text(strip=True).isdigit() else 0
                        enrol = int(cells[6].get_text(strip=True)) if len(cells) > 6 and cells[6].get_text(strip=True).isdigit() else 0

                        # Cell 9: Remarks
                        remarks = cells[9].get_text(strip=True) if len(cells) > 9 else ""

                        current_section = {
                            "sectionId": f"{code.replace(' ', '')}-{section_id}",
                            "sectionType": sec_type.upper(),
                            "courseCode": code,
                            "instructor": instructor,
                            "timeSlots": time_slots,
                            "quota": quota,
                            "enrol": enrol,
                            "remarks": remarks,
                            "crn": crn,
                            "_room": room,  # keep for otherRow venue
                        }

                    elif "otherRow" in classes and current_section is not None:
                        # ── additional time slot row for the current section ──
                        if len(cells) >= 2:
                            datetime_str = cells[1].get_text(strip=True)
                            room = current_section.get("_room", "")
                            extra_slots = _parse_time_slots(datetime_str, venue=room)
                            current_section["timeSlots"].extend(extra_slots)

                # Save the last section
                if current_section is not None:
                    # Clean up internal _room key before appending
                    current_section.pop("_room", None)
                    sections.append(current_section)
                    current_section = None

            # Determine school from code prefix
            prefix = code.split()[0] if " " in code else code[:4]
            school = DEPARTMENT_TO_SCHOOL.get(prefix, "")

            courses.append({
                "code": code,
                "title": title,
                "credits": credits,
                "school": school,
                "department": prefix,
                "description": description,
                "prerequisites": prerequisites,
                "corequisites": corequisites,
                "exclusions": exclusions,
                "sections": sections,
                "rating": None,
            })

        except Exception as e:
            print(f"    [WARN] Parse error for a course in {dept}: {e}")
            continue

    return courses


async def scrape_all(
    term: str = "2610",
    dept_filter: Optional[list[str]] = None,
    delay: float = 1.0,
) -> list[dict]:
    """Scrape all departments and return a list of course dicts."""
    depts = dept_filter if dept_filter else DEPARTMENT_CODES
    all_courses: list[dict] = []

    async with httpx.AsyncClient(
        timeout=30.0,
        headers={
            "User-Agent": "CoursePlanner/0.1 (Educational project; contact via GitHub)",
            "Accept": "text/html,application/xhtml+xml",
        },
    ) as client:
        for i, dept in enumerate(depts):
            try:
                courses = await scrape_subject(client, term, dept)
                all_courses.extend(courses)
                print(f"  [{dept}] → {len(courses)} courses parsed")
            except Exception as e:
                print(f"  [{dept}] ERROR: {e}")

            # Rate limiting: be polite to the server
            if i < len(depts) - 1:
                await asyncio.sleep(delay)

    return all_courses


# ── CLI ────────────────────────────────────────────────────

async def main():
    """CLI entry point for the scraper."""
    import argparse

    parser = argparse.ArgumentParser(description="HKUST Course Data Scraper")
    parser.add_argument(
        "--term", default="2610",
        help="Term code: 2610=2026-27 Fall, 2520=2025-26 Spring, 2510=2025-26 Fall"
    )
    parser.add_argument("--output", default="data/courses.json", help="Output JSON file")
    parser.add_argument(
        "--schools", default="",
        help="Comma-separated school codes to scrape (SENG,SSCI,SBM,SHSS). Empty = all."
    )
    parser.add_argument(
        "--delay", type=float, default=1.0,
        help="Delay between requests in seconds (default: 1.0)"
    )
    args = parser.parse_args()

    # Filter departments by school if specified
    dept_filter = None
    if args.schools:
        target_schools = {s.strip().upper() for s in args.schools.split(",")}
        dept_filter = [
            d for d in DEPARTMENT_CODES
            if DEPARTMENT_TO_SCHOOL.get(d, "") in target_schools
        ]
        print(f"Filtering to schools: {target_schools} → {len(dept_filter)} departments")

    print(f"CoursePlanner Scraper")
    print(f"  Term: {args.term}")
    print(f"  Output: {args.output}")
    print(f"  Departments to scrape: {len(dept_filter) if dept_filter else len(DEPARTMENT_CODES)}")
    print()

    courses = await scrape_all(term=args.term, dept_filter=dept_filter, delay=args.delay)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(courses, indent=2, ensure_ascii=False)
    )

    total_sections = sum(len(c.get("sections", [])) for c in courses)
    print(f"\n[DONE] {len(courses)} courses, {total_sections} sections → {args.output}")


if __name__ == "__main__":
    asyncio.run(main())
