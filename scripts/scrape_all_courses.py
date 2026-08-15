#!/usr/bin/env python3
"""Scrape ALL undergraduate courses from prog-crs.hkust.edu.hk/ugcourse.

Uses requests.Session with connection pooling for reliable HTTP.
Usage: python3 scripts/scrape_all_courses.py [--year 2024-25]
"""

import json
import re
import sys
import time
import argparse
from html.parser import HTMLParser

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

YEARS = ["2022-23", "2023-24", "2024-25", "2025-26", "2026-27"]
BASE = "https://prog-crs.hkust.edu.hk/ugcourse"
TIMEOUT = (10, 30)  # (connect, read) in seconds


def make_session() -> requests.Session:
    """Create a requests session with retry logic."""
    s = requests.Session()
    retries = Retry(total=2, backoff_factor=0.5,
                    status_forcelist=[500, 502, 503, 504])
    adapter = HTTPAdapter(max_retries=retries, pool_connections=10, pool_maxsize=20)
    s.mount('https://', adapter)
    s.mount('http://', adapter)
    return s


def fetch(session: requests.Session, url: str) -> str:
    """Fetch URL with retry on transient errors."""
    resp = session.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    if not resp.text.strip():
        raise Exception("empty response")
    return resp.text


# ── Subject list parser ──────────────────────────────────────────────────

class SubjectListParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.subjects: list[str] = []
        self._in_subject = False
        self._capture_code = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        cls = dict(attrs).get("class", "")
        if tag == "li" and "subject" in cls:
            self._in_subject = True
        if self._in_subject and tag == "div" and "subject-code" in cls:
            self._capture_code = True

    def handle_endtag(self, tag: str):
        if tag == "li" and self._in_subject:
            self._in_subject = False

    def handle_data(self, data: str):
        if self._capture_code:
            code = data.strip()
            if code:
                self.subjects.append(code)
            self._capture_code = False


# ── Course list parser ───────────────────────────────────────────────────

class SubjectCourseParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.courses: list[dict] = []
        self._in_crse = False
        self._in_code = False
        self._in_title = False
        self._in_unit = False
        self._current: dict = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        cls = dict(attrs).get("class", "")
        if tag == "li" and "crse" in cls and "accordion-item" in cls:
            self._in_crse = True
            self._current = {}
        if self._in_crse:
            if tag == "div" and "crse-code" in cls:
                self._in_code = True
            elif tag == "div" and "crse-title" in cls:
                self._in_title = True
            elif tag == "div" and "crse-unit" in cls:
                self._in_unit = True

    def handle_endtag(self, tag: str):
        if tag == "li" and self._in_crse:
            self._in_crse = False
            if "code" in self._current and self._current["code"]:
                self.courses.append(self._current)
        if tag == "div":
            self._in_code = False
            self._in_title = False
            self._in_unit = False

    def handle_data(self, data: str):
        text = data.strip()
        if not text:
            return
        if self._in_code:
            self._current["code"] = text
        elif self._in_title:
            self._current["title"] = text
        elif self._in_unit:
            m = re.search(r'(\d+)', text)
            self._current["credits"] = int(m.group(1)) if m else 3


# ── Scrape one year ──────────────────────────────────────────────────────

def scrape_year(session: requests.Session, year: str) -> dict[str, list[dict]]:
    print(f"\n{'='*60}")
    print(f"Year {year}")
    print(f"{'='*60}")

    # Get subject list
    main_url = f"{BASE}/{year}/"
    print(f"  Fetching subject list...", end=" ", flush=True)
    html = fetch(session, main_url)
    sl_parser = SubjectListParser()
    sl_parser.feed(html)
    subjects = sl_parser.subjects
    print(f"{len(subjects)} subjects")

    # Scrape each subject
    result: dict[str, list[dict]] = {}
    total = 0
    for i, subj in enumerate(subjects):
        url = f"{BASE}/{year}/{subj}/"
        try:
            html = fetch(session, url)
            sc_parser = SubjectCourseParser()
            sc_parser.feed(html)
            result[subj] = sc_parser.courses
            total += len(sc_parser.courses)
            print(f"  [{i+1:2d}/{len(subjects)}] {subj:6s}: {len(sc_parser.courses):3d} courses")
        except Exception as e:
            print(f"  [{i+1:2d}/{len(subjects)}] {subj:6s}: SKIP ({e})")
            result[subj] = []
        sys.stdout.flush()

    print(f"  Year total: {total} courses")
    return result


# ── Merge union across years ─────────────────────────────────────────────

def merge_union(all_year_data: dict[str, dict[str, list[dict]]]) -> list[dict]:
    seen: dict[str, dict] = {}

    for year, subjects in all_year_data.items():
        for subj, courses in subjects.items():
            for c in courses:
                key = c["code"]
                if key not in seen:
                    seen[key] = {
                        "code": key,
                        "title": c["title"],
                        "credits": c.get("credits", 3),
                        "department": key.split()[0] if " " in key else subj,
                    }

    return list(seen.values())


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Scrape ugcourse for all course data")
    parser.add_argument("--year", type=str, default=None,
                        help="Scrape only a specific year (e.g. '2024-25')")
    args = parser.parse_args()

    years = [args.year] if args.year else YEARS

    session = make_session()
    all_year_data: dict[str, dict[str, list[dict]]] = {}

    for year in years:
        try:
            all_year_data[year] = scrape_year(session, year)
        except Exception as e:
            print(f"  Year {year}: FATAL - {e}", file=sys.stderr)

    session.close()

    print(f"\n{'='*60}")
    print("Merging union across all years...")
    print(f"{'='*60}")

    all_courses = merge_union(all_year_data)
    all_courses.sort(key=lambda c: c["code"])

    depts = set(c["department"] for c in all_courses)
    print(f"\nUnique courses: {len(all_courses)}")
    print(f"Unique departments: {len(depts)}")
    print()
    for year in years:
        yr_data = all_year_data.get(year, {})
        yr_total = sum(len(v) for v in yr_data.values())
        print(f"  {year}: {yr_total} courses, {len(yr_data)} subjects")

    output_path = "data/all_courses.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_courses, f, ensure_ascii=False, indent=2)
    print(f"\nWritten {len(all_courses)} courses to {output_path}")


if __name__ == "__main__":
    main()
