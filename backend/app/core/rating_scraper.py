"""Professor rating scraper for HKUST instructor ratings.

Data sources:

    UST Rankings (https://ust-rankings.com) — PRIMARY
        A Next.js app that aggregates ratings from both ust.space and SFQ
        (Student Feedback Questionnaire). Shows instructors ranked by Bayesian
        z-scores across 6 criteria: content, teaching, grading, workload
        (ust.space) + course, instructor (SFQ).

        The overall_grade uses UST Rankings' DEFAULT SCORE FORMULA:
            content.bayesian    * 2/3 * 0.4  +
            teaching.bayesian   * 2/3 * 0.4  +
            grading.bayesian    * 2/3 * 0.15 +
            workload.bayesian   * 2/3 * 0.05 +
            course.bayesian     * 1/3 * 0.25 +
            instructor.bayesian * 1/3 * 0.75

        Percentile-rank calculation (matches UST Rankings):
            percentile = 1 - rank_from_best / total  (0-indexed rank)

        EXACT letter-grade thresholds (extracted from UST Rankings source):
            A+ : ≥ 0.90    B  : ≥ 0.45    C- : ≥ 0.20
            A  : ≥ 0.80    B- : ≥ 0.35    D  : ≥ 0.10
            A- : ≥ 0.75    C+ : ≥ 0.30    F  : ≥ 0.00
            B+ : ≥ 0.60    C  : ≥ 0.25

        teaching_grade = teaching criterion bayesian z-score percentile.
        grading_grade  = grading criterion bayesian z-score percentile.

        All grades are percentile-ranked across all HKUST instructors with data.

        Data is embedded in the TURBOPACK JS chunk loaded by the homepage.
        To refresh ratings:
        1. Download the latest chunk from https://ust-rankings.com/
        2. Extract the JSON array from JSON.parse('...')
        3. Compute weighted score using the formula above, map to letter grades
           using the percentile thresholds above
        4. Save to data/professor_ratings.json

    USTSpace (https://ust.space) — FALLBACK
        HKUST community site where students rate/review courses and professors.
        Requires ITSC authentication. Review pages at /review/{COURSE_CODE}.
        NOTE: Session cookie persistence has been unreliable — UST Rankings is
        preferred. See scrape mode below.

Modes:
    seed    — Extract instructor names from courses.json and generate a
              template ratings file with placeholder scores.

    scrape  — Log into ust.space with ITSC credentials and scrape review pages.
              NOTE: UST Rankings extraction (see above) is recommended instead.

Usage:
    python -m app.core.rating_scraper --mode seed --courses data/courses.json --output data/professor_ratings.json
    python -m app.core.rating_scraper --mode scrape --username <ITSC> --password <PW> --output data/professor_ratings.json
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

# ── Constants ──────────────────────────────────────────────

BASE_URL = "https://ust.space"
LOGIN_URL = f"{BASE_URL}/login"
SITEMAP_URL = f"{BASE_URL}/sitemap.xml"
REVIEW_PATH = "/review/"

USER_AGENT = "CoursePlanner/0.1 (Educational project; HKUST student tool)"


# ── Helpers ─────────────────────────────────────────────────

def normalize_name(name: str) -> str:
    """Normalize an instructor name for matching.

    Handles formats:
        "DONG, Qingkai"      → "DONG, QINGKAI"
        "DONG Qingkai"       → "DONG, QINGKAI"
        "Qingkai DONG"       → "DONG, QINGKAI"
        "SONG, XueyangYANG, Sen" → multiple instructors remain as-is
    """
    name = name.strip()
    if not name or name.upper() == "TBA":
        return name

    parts = name.split(",")
    # Check if last-name-first format: "LAST, First"
    if len(parts) >= 2 and len(parts[0].strip()) <= 20:
        # Already in LAST, First format — just uppercase
        return ",".join(p.strip().upper() for p in parts)

    # Otherwise, try to identify the last name
    # Most HKUST instructors use "LAST, First" in the class schedule
    return name.upper()


def normalize_name_key(name: str) -> str:
    """Create a matchable key from a name: lowercase, no spaces/punctuation."""
    return re.sub(r"[^a-z]", "", normalize_name(name).lower())


def parse_float(val: str) -> float:
    """Safely parse a float from a string like '4.2' or '3.5/5'."""
    val = val.strip()
    # Handle "4.2/5" format
    if "/" in val:
        parts = val.split("/")
        try:
            return float(parts[0].strip())
        except (ValueError, IndexError):
            pass
    try:
        return float(val)
    except ValueError:
        return 0.0


def parse_int(val: str) -> int:
    """Safely parse an integer from a string."""
    try:
        return int(re.sub(r"[^\d]", "", val.strip()))
    except ValueError:
        return 0


def _score_to_grade(score: float) -> str:
    """Convert a 0-5 numerical score to a letter grade."""
    if score >= 4.5:
        return "A+"
    elif score >= 4.0:
        return "A"
    elif score >= 3.7:
        return "A-"
    elif score >= 3.3:
        return "B+"
    elif score >= 3.0:
        return "B"
    elif score >= 2.7:
        return "B-"
    elif score >= 2.3:
        return "C+"
    elif score >= 2.0:
        return "C"
    elif score >= 1.7:
        return "C-"
    elif score >= 1.0:
        return "D"
    elif score > 0:
        return "F"
    return ""


# ── Seed Mode ───────────────────────────────────────────────

def generate_seed_ratings(courses_path: str) -> list[dict]:
    """Extract all unique instructor names from courses.json and create
    a template ratings file with placeholder (zero) scores."""
    with open(courses_path) as f:
        courses = json.load(f)

    instructors: dict[str, dict] = {}

    for course in courses:
        dept = course.get("department", "")
        school = course.get("school", "")

        for sec in course.get("sections", []):
            raw_name = sec.get("instructor", "").strip()
            if not raw_name or raw_name.upper() == "TBA":
                continue

            # Split multi-instructor entries
            # Pattern: "LAST, FirstLAST, First" or "LAST, FirstLAST2, First2"
            # The format from the scraper can have concatenated names
            names = [raw_name]  # Keep as single entry; matching is fuzzy

            for name in names:
                key = normalize_name(name)
                if key and key not in instructors:
                    instructors[key] = {
                        "name": name,
                        "school": school,
                        "overall_grade": "",
                        "overall_gpa": 0.0,
                        "teaching_grade": "",
                        "teaching_gpa": 0.0,
                        "grading_grade": "",
                        "grading_gpa": 0.0,
                        "review_count": 0,
                        "source": "seed",
                    }

    result = sorted(instructors.values(), key=lambda r: r["name"])
    return result


# ── Scrape Mode ─────────────────────────────────────────────

class USTSpaceScraper:
    """Scrapes professor ratings from ust.space by logging in and
    iterating course review pages."""

    def __init__(self, username: str, password: str, delay: float = 1.0):
        self.username = username
        self.password = password
        self.delay = delay
        self._client: Optional[httpx.AsyncClient] = None
        self._ratings: dict[str, dict] = {}  # normalized name → rating dict

    async def __aenter__(self):
        self._client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml",
            },
            follow_redirects=False,
        )
        return self

    async def __aexit__(self, *args):
        if self._client:
            await self._client.aclose()

    async def login(self) -> bool:
        """Log into ust.space with ITSC credentials.

        Uses httpx's built-in cookie jar — no explicit cookie passing,
        so session cookies persist automatically across requests.
        """
        if not self._client:
            return False

        # Step 1: GET login page to get CSRF token (cookies auto-stored in client)
        print("  Fetching login page...")
        resp = await self._client.get(LOGIN_URL)
        if resp.status_code != 200:
            print(f"  Login page returned {resp.status_code}")
            return False

        soup = BeautifulSoup(resp.text, "lxml")
        token_input = soup.find("input", {"name": "_token"})
        csrf_token = token_input["value"] if token_input else ""

        if not csrf_token:
            print("  Could not find CSRF token")
            return False

        # Step 2: POST login — httpx auto-sends cookies from step 1
        print("  Submitting login...")
        login_resp = await self._client.post(
            LOGIN_URL,
            data={
                "_token": csrf_token,
                "username": self.username,
                "password": self.password,
            },
            # No explicit cookies= — let httpx cookie jar handle it
        )

        # After POST, client.cookies now contains auth session from Set-Cookie

        # Check result
        if login_resp.status_code in (302, 301, 303):
            location = login_resp.headers.get("location", "")
            if "/login" not in location:
                print(f"  Login successful! Redirected to: {location}")
                # Follow the redirect to finalize session cookies
                try:
                    await self._client.get(
                        urljoin(BASE_URL, location) if not location.startswith("http") else location,
                    )
                except Exception:
                    pass
                return True

        # If we got 200, we might still be logged in (some sites do JS redirect)
        if login_resp.status_code == 200:
            # Check if login page still shows login form
            if "Log into your USTSPACE account" in login_resp.text:
                # Check for specific error messages
                if "Invalid" in login_resp.text or "wrong" in login_resp.text.lower():
                    print("  Login failed: invalid credentials")
                    return False
                if "CSRF" in login_resp.text or "token" in login_resp.text.lower():
                    print("  Login failed: CSRF token mismatch (session issue)")
                    return False
                print("  Login failed: credentials rejected")
                return False
            # No login form found — probably logged in
            print("  Login appears successful (session established)")
            return True

        print(f"  Login returned unexpected status {login_resp.status_code}")
        return False

    async def fetch_course_reviews(
        self, course_code: str, debug: bool = False, save_html: bool = False,
    ) -> list[dict]:
        """Fetch and parse the review page for a single course."""
        if not self._client:
            return []

        url = f"{BASE_URL}/review/{course_code}"
        try:
            resp = await self._client.get(url)
        except Exception as e:
            if debug:
                print(f"    Error fetching {course_code}: {e}")
            return []

        if resp.status_code != 200:
            return []

        # Check if redirected to login
        if "/login" in str(resp.url) or "Log into your USTSPACE" in resp.text[:500]:
            print("    Session expired — need to re-login")
            return []

        # Save HTML for debugging
        if save_html:
            html_dir = Path("debug_html")
            html_dir.mkdir(exist_ok=True)
            safe_name = course_code.replace("/", "_").replace(" ", "_")
            (html_dir / f"{safe_name}.html").write_text(resp.text)
            (html_dir / "home.html").write_text(resp.text[:500])
            print(f"    Saved HTML to debug_html/{safe_name}.html")

        return self._parse_review_page(resp.text, course_code, debug=debug)

    def _parse_review_page(self, html: str, course_code: str, debug: bool = False) -> list[dict]:
        """Parse a course review page and extract professor ratings."""
        soup = BeautifulSoup(html, "lxml")
        results = []

        if debug:
            # Dump page structure for investigation
            title = soup.find("title")
            print(f"\n    ┌─ DEBUG: {course_code} ─────────────────")
            print(f"    │ Title: {title.get_text(strip=True) if title else 'N/A'}")
            print(f"    │ Size: {len(html)} bytes")

            # Find all divs with classes
            for tag in soup.find_all(["div", "table", "section"], class_=True):
                classes = " ".join(tag.get("class", []))
                text_preview = tag.get_text(" ", strip=True)[:120]
                if any(kw in classes.lower() for kw in ["review", "rating", "professor", "instructor", "score", "grade", "comment"]):
                    print(f"    │ <{tag.name} class=\"{classes[:80]}\">: {text_preview}")

            # Find all text containing "overall" or "rating" or "professor"
            for text_node in soup.stripped_strings:
                t = text_node.strip()
                if any(kw in t.lower() for kw in ["overall", "professor", "rating", "score", "taught", "instructor", "grade", "difficulty", "review"]):
                    if len(t) > 3:
                        print(f"    │ TEXT: {t[:150]}")
            print(f"    └──────────────────────────────────────\n")

        # Strategy 1: Look for review cards/blocks
        # Common USTSpace patterns: review items within a list or grid
        review_containers = (
            soup.find_all("div", class_=re.compile(r"review-item|review-card|review_block|单个", re.I))
            or soup.find_all("li", class_=re.compile(r"review", re.I))
            or soup.find_all("div", class_=re.compile(r"comment|feedback|entry|rating-row", re.I))
        )

        # Strategy 2: Look for aggregate rating summary at top of page
        summary_section = (
            soup.find("div", class_=re.compile(r"summary|aggregate|overall|rating-summary|course-header", re.I))
            or soup.find("div", class_=re.compile(r"course-info|course_detail|评分|总评", re.I))
        )

        if summary_section:
            results.extend(self._extract_ratings_from_block(summary_section, course_code))

        # Strategy 3: Process individual reviews
        if review_containers:
            for container in review_containers:
                results.extend(self._extract_ratings_from_block(container, course_code))
        else:
            # Strategy 4: Try to find any structured data
            # Look for tables with rating data
            for table in soup.find_all("table"):
                results.extend(self._extract_ratings_from_table(table, course_code))

            # Strategy 5: Full-page text extraction
            if not results:
                results.extend(self._extract_ratings_from_text(soup.get_text(" ", strip=True), course_code))

        # Debug: show what we found
        if debug and results:
            for r in results:
                print(f"    FOUND: {r['name']} — overall={r['overall_gpa']}, teaching={r['teaching_gpa']}, grading={r['grading_gpa']}")

        return results

    def _extract_ratings_from_block(self, element, course_code: str) -> list[dict]:
        """Extract rating info from an HTML element (div, section, etc.)."""
        results = []
        text = element.get_text(" ", strip=True)
        if len(text) < 20:
            return results

        # Try to find professor name
        prof_match = re.search(
            r"(?:Prof\.?|Professor|Instructor|Lecturer|Taught by)[:\s]*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})",
            text, re.I,
        )
        professor = prof_match.group(1).strip() if prof_match else ""

        # Try to find rating numbers
        overall = 0.0
        overall_match = re.search(r"(?:Overall|Rating|Score|总评)[:\s]*([\d.]+)\s*(?:/\s*5)?", text, re.I)
        if not overall_match:
            # Look for star ratings: "★★★★☆ 4.2" or "4.2/5"
            overall_match = re.search(r"(?:★|☆)+\s*([\d.]+)", text)
        if overall_match:
            overall = parse_float(overall_match.group(1))

        teaching = 0.0
        teaching_match = re.search(r"(?:Teaching|Quality|教学质量)[:\s]*([\d.]+)", text, re.I)
        if teaching_match:
            teaching = parse_float(teaching_match.group(1))

        grading = 0.0
        grading_match = re.search(r"(?:Grading|Difficulty|Turtle|Fairness|给分|龟)[:\s]*([\d.]+)", text, re.I)
        if grading_match:
            grading = parse_float(grading_match.group(1))

        reviews = 0
        reviews_match = re.search(r"(\d+)\s*(?:review|rating|evaluation|评价|评论)", text, re.I)
        if reviews_match:
            reviews = parse_int(reviews_match.group(1))

        if professor and (overall > 0 or teaching > 0 or grading > 0):
            key = normalize_name(professor)
            # Keep the best entry
            if key not in self._ratings or overall > self._ratings[key].get("overall_gpa", 0):
                self._ratings[key] = {
                    "name": professor,
                    "school": "",
                    "overall_grade": _score_to_grade(overall),
                    "overall_gpa": overall,
                    "teaching_grade": _score_to_grade(teaching),
                    "teaching_gpa": teaching,
                    "grading_grade": _score_to_grade(grading),
                    "grading_gpa": grading,
                    "review_count": reviews,
                    "source": "ustspace",
                }
            results.append(self._ratings[key])

        return results

    def _extract_ratings_from_table(self, table, course_code: str) -> list[dict]:
        """Extract ratings from an HTML table."""
        results = []
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all(["td", "th"])
            cell_texts = [c.get_text(strip=True) for c in cells]
            if len(cell_texts) >= 3:
                # Look for professor name + rating pattern
                joined = " | ".join(cell_texts)
                prof = re.search(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})", joined)
                rat = re.search(r"([\d.]+)\s*(?:/\s*5)?", joined)
                if prof and rat:
                    name = prof.group(1).strip()
                    score = parse_float(rat.group(1))
                    if score > 0 and len(name) > 3:
                        key = normalize_name(name)
                        self._ratings[key] = {
                            "name": name,
                            "school": "",
                            "overall_grade": _score_to_grade(score),
                            "overall_gpa": score,
                            "teaching_grade": "",
                            "teaching_gpa": 0.0,
                            "grading_grade": "",
                            "grading_gpa": 0.0,
                            "review_count": 0,
                            "source": "ustspace",
                        }
                        results.append(self._ratings[key])
        return results

    def _extract_ratings_from_text(self, text: str, course_code: str) -> list[dict]:
        """Fallback: extract any professor+rating patterns from raw text."""
        results = []
        # Pattern: "Prof. John SMITH" followed by a rating number nearby
        for match in re.finditer(
            r"(?:Prof\.?|Professor|Instructor|Dr\.?)\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})",
            text,
        ):
            prof = match.group(1).strip()
            # Look for a rating within 100 chars after the professor name
            after = text[match.end():match.end()+150]
            rat = re.search(r"([\d.]+)\s*(?:/\s*5)?", after)
            if rat:
                score = parse_float(rat.group(1))
                if 0 < score <= 5:
                    key = normalize_name(prof)
                    self._ratings[key] = {
                        "name": prof,
                        "school": "",
                        "overall_grade": _score_to_grade(score),
                        "overall_gpa": score,
                        "teaching_grade": "",
                        "teaching_gpa": 0.0,
                        "grading_grade": "",
                        "grading_gpa": 0.0,
                        "review_count": 0,
                        "source": "ustspace",
                    }
                    results.append(self._ratings[key])
        return results

    async def scrape_all(
        self, course_codes: Optional[list[str]] = None, debug: bool = False,
        save_html: bool = False,
    ) -> list[dict]:
        """Scrape ratings for all courses (or specified subset)."""
        if not self._client:
            return []

        # If no codes given, fetch sitemap to get all course review URLs
        if not course_codes:
            print("Fetching sitemap for course list...")
            course_codes = await self._fetch_sitemap_courses()
            print(f"  Found {len(course_codes)} course review pages in sitemap")

        if debug:
            print(f"\n--- DEBUG MODE: Showing first 3 course pages ---")

        if save_html:
            Path("debug_html").mkdir(exist_ok=True)

        print(f"Scraping ratings for {len(course_codes)} courses...")
        for i, code in enumerate(course_codes):
            is_debug = debug and i < 3
            await self.fetch_course_reviews(code, debug=is_debug, save_html=(save_html and i < 5))

            if (i + 1) % 20 == 0:
                print(f"  Progress: {i+1}/{len(course_codes)} "
                      f"({len(self._ratings)} professors found)")

            # Rate limiting
            if i < len(course_codes) - 1:
                await asyncio.sleep(self.delay)

        print(f"  Done! {len(self._ratings)} unique professors found")
        return sorted(self._ratings.values(), key=lambda r: r["name"])

    async def _fetch_sitemap_courses(self) -> list[str]:
        """Parse the sitemap to extract all course review URLs."""
        if not self._client:
            return []

        try:
            resp = await self._client.get(SITEMAP_URL)
            if resp.status_code != 200:
                print(f"  Sitemap returned {resp.status_code}")
                return []
        except Exception as e:
            print(f"  Sitemap fetch error: {e}")
            return []

        # Try XML parser first; fall back to HTML parser
        try:
            soup = BeautifulSoup(resp.text, "xml")
        except Exception:
            soup = BeautifulSoup(resp.text, "lxml")

        codes = []
        for loc in soup.find_all("loc"):
            url = loc.get_text(strip=True)
            if REVIEW_PATH in url:
                code = url.split(REVIEW_PATH)[-1].strip()
                if code and code not in codes:
                    codes.append(code)

        # If XML parser found nothing, try regex fallback
        if not codes:
            import re as _re
            codes = list(set(_re.findall(
                r"https?://ust\.space/review/([A-Za-z0-9]+)",
                resp.text,
            )))
            codes.sort()

        print(f"  Parsed {len(codes)} course review URLs from sitemap")
        return codes


# ── CLI ────────────────────────────────────────────────────

# Security: Credentials are NEVER hardcoded. They are read from:
#   1. Environment variables: USTSPACE_USERNAME, USTSPACE_PASSWORD  (safest)
#   2. Interactive prompt (no echo for password)
#   3. CLI arguments (avoid — they leak to shell history)
#
# The output file (professor_ratings.json) contains ONLY professor names and
# scores — NO credentials. It is safe to commit to git.

def _get_credentials(args) -> tuple[str, str]:
    """Resolve credentials from env vars, interactive prompt, or CLI args.

    Priority: env vars > interactive > CLI args
    """
    import getpass

    username = ""
    password = ""

    # 1. Environment variables (safest — never touches disk or shell history)
    env_user = os.environ.get("USTSPACE_USERNAME", "")
    env_pass = os.environ.get("USTSPACE_PASSWORD", "")

    if env_user and env_pass:
        print("Using credentials from environment variables (USTSPACE_USERNAME / USTSPACE_PASSWORD)")
        return env_user, env_pass

    # 2. CLI args (only if both provided, with warning)
    if args.username and args.password:
        print("⚠  WARNING: Credentials passed via CLI arguments are visible in shell history.")
        print("   Prefer environment variables: export USTSPACE_USERNAME=... USTSPACE_PASSWORD=...")
        print("   Or omit --username/--password to use interactive prompt.")
        print()
        return args.username, args.password

    # 3. Interactive prompt (safe — password hidden, not saved to history)
    print("No credentials found in environment or CLI.")
    print("Enter your ITSC credentials (password input is hidden):")
    username = input("  Username: ").strip()
    password = getpass.getpass("  Password: ").strip()

    if not username or not password:
        print("[ERROR] Username and password are required.")
        sys.exit(1)

    return username, password


async def run_scrape(args):
    """Run the scrape mode."""
    username, password = _get_credentials(args)

    async with USTSpaceScraper(username, password, args.delay) as scraper:
        print(f"\nLogging into {BASE_URL}...")
        if not await scraper.login():
            print("[ERROR] Login failed. Check your ITSC credentials.")
            sys.exit(1)

        ratings = await scraper.scrape_all(debug=args.debug, save_html=args.save_html)

        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(ratings, indent=2, ensure_ascii=False))
        print(f"\n[DONE] {len(ratings)} professor ratings → {args.output}")


def run_seed(args):
    """Run the seed mode."""
    print(f"Extracting instructors from {args.courses}...")
    ratings = generate_seed_ratings(args.courses)
    print(f"  {len(ratings)} unique instructors found")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(ratings, indent=2, ensure_ascii=False))
    print(f"[DONE] Seed ratings template → {args.output}")
    print(f"  NOTE: All scores are 0.0. Run with --mode scrape to get real data.")


async def main():
    parser = argparse.ArgumentParser(
        description="Professor rating scraper for USTSpace",
        epilog="""
Security:
  Credentials are read from (in order of preference):
    1. Environment variables USTSPACE_USERNAME and USTSPACE_PASSWORD
    2. Interactive prompt (password hidden, not saved to history)
    3. --username and --password CLI flags (⚠ avoid — visible in shell history)

Examples:
  # Safest: use environment variables
  export USTSPACE_USERNAME=myitsc USTSPACE_PASSWORD=mypw
  python -m app.core.rating_scraper --mode scrape

  # Safe: interactive prompt
  python -m app.core.rating_scraper --mode scrape
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--mode", choices=["seed", "scrape"], default="seed",
        help="seed: extract instructors from courses.json; scrape: login and scrape"
    )
    parser.add_argument(
        "--courses", default="data/courses.json",
        help="Path to courses.json (for seed mode)"
    )
    parser.add_argument(
        "--output", default="data/professor_ratings.json",
        help="Output JSON file"
    )
    parser.add_argument(
        "--username", default="",
        help="ITSC username (⚠ avoid — use env var or interactive prompt instead)"
    )
    parser.add_argument(
        "--password", default="",
        help="ITSC password (⚠ avoid — use env var or interactive prompt instead)"
    )
    parser.add_argument(
        "--delay", type=float, default=1.0,
        help="Delay between requests in seconds (default: 1.0)"
    )
    parser.add_argument(
        "--debug", action="store_true",
        help="Print HTML structure for first 3 courses to debug parsing"
    )
    parser.add_argument(
        "--save-html", action="store_true", dest="save_html",
        help="Save raw HTML of first 5 course pages to debug_html/ directory"
    )
    args = parser.parse_args()

    if args.mode == "scrape":
        await run_scrape(args)
    else:
        run_seed(args)


if __name__ == "__main__":
    asyncio.run(main())
