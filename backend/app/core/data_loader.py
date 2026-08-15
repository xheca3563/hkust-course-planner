"""Load course data and professor ratings from JSON files into the application."""

import json
from pathlib import Path
from app.models.schemas import Course, Section, TimeSlot, DayOfWeek, ProfessorRating

# Look for courses.json in multiple locations
DATA_PATHS = [
    Path(__file__).parent.parent.parent.parent / "data" / "courses.json",  # project_root/data/
    Path(__file__).parent.parent / "data" / "courses.json",                 # backend/app/data/
    Path("data/courses.json"),
]

# Professor ratings data paths
RATING_DATA_PATHS = [
    Path(__file__).parent.parent.parent.parent / "data" / "professor_ratings.json",
    Path(__file__).parent.parent / "data" / "professor_ratings.json",
    Path("data/professor_ratings.json"),
]


def load_courses() -> dict[str, Course]:
    """Load all courses from the JSON data file.

    Returns a dict mapping course code (uppercase) to Course object.
    """
    data_path = None
    for p in DATA_PATHS:
        if p.exists():
            data_path = p
            break

    if not data_path:
        print("[WARN] No courses.json found. Using empty course list.")
        return {}

    with open(data_path) as f:
        raw = json.load(f)

    courses: dict[str, Course] = {}
    for item in raw:
        # Parse sections
        sections = []
        for sec_data in item.get("sections", []):
            time_slots = []
            for ts in sec_data.get("timeSlots", []):
                time_slots.append(TimeSlot(
                    day=DayOfWeek(ts["day"]),
                    start_time=ts["startTime"],
                    end_time=ts["endTime"],
                    venue=ts.get("venue", ""),
                ))

            sections.append(Section(
                section_id=sec_data["sectionId"],
                section_type=sec_data["sectionType"],
                course_code=sec_data["courseCode"],
                instructor=sec_data.get("instructor", "TBA"),
                time_slots=time_slots,
                quota=sec_data.get("quota", 0),
                enrol=sec_data.get("enrol", 0),
                remarks=sec_data.get("remarks", ""),
            ))

        # Parse course
        course = Course(
            code=item["code"],
            title=item["title"],
            credits=item.get("credits", 3),
            school=item.get("school", ""),
            department=item.get("department", ""),
            description=item.get("description", ""),
            prerequisites=item.get("prerequisites", ""),
            corequisites=item.get("corequisites", ""),
            exclusions=item.get("exclusions", ""),
            sections=sections,
            rating=item.get("rating"),
        )

        courses[course.code.upper()] = course

    print(f"[OK] Loaded {len(courses)} courses from {data_path}")
    return courses


def normalize_name_key(name: str) -> str:
    """Create a matchable key from an instructor name.

    Strips whitespace, lowercases, removes non-alphanumeric chars.
    "DONG, Qingkai" → "dongqingkai"
    "SONG, XueyangYANG, Sen" → "songxueyangyangsen"
    """
    import re
    return re.sub(r"[^a-z0-9]", "", name.lower())


def load_ratings() -> dict[str, ProfessorRating]:
    """Load professor ratings from JSON data file.

    Returns a dict mapping normalized instructor name to ProfessorRating.
    Multiple keys per entry for fuzzy matching.
    """
    data_path = None
    for p in RATING_DATA_PATHS:
        if p.exists():
            data_path = p
            break

    if not data_path:
        print("[WARN] No professor_ratings.json found. Rating features disabled.")
        return {}

    with open(data_path) as f:
        raw = json.load(f)

    ratings: dict[str, ProfessorRating] = {}
    for item in raw:
        rating = ProfessorRating(
            name=item.get("name", ""),
            school=item.get("school", ""),
            overall_grade=item.get("overall_grade", ""),
            overall_gpa=item.get("overall_gpa", 0.0),
            teaching_grade=item.get("teaching_grade", ""),
            teaching_gpa=item.get("teaching_gpa", 0.0),
            grading_grade=item.get("grading_grade", ""),
            grading_gpa=item.get("grading_gpa", 0.0),
            review_count=item.get("review_count", item.get("reviewCount", 0)),
            source=item.get("source", ""),
            latest_term=item.get("latest_term", ""),
        )

        # Index by normalized name for matching
        key = normalize_name_key(rating.name)
        ratings[key] = rating

        # Also index by just the last name for partial matching
        # "DONG, Qingkai" → also index "dong"
        parts = rating.name.replace(",", " ").split()
        if parts:
            last_name = parts[0].lower()
            if last_name not in ratings:
                ratings[last_name] = rating

    print(f"[OK] Loaded {len(raw)} professor ratings from {data_path}")
    return ratings


# ── Course catalog (all courses ever offered, for completed-courses browser) ──

CATALOG_PATHS = [
    Path(__file__).parent.parent.parent.parent / "data" / "all_courses.json",
    Path("data/all_courses.json"),
]

_catalog_cache: list[dict] | None = None


def load_course_catalog() -> list[dict]:
    """Load the full course catalog (union of all historical years).

    Returns a list of {code, title, credits, department} dicts.
    Cached in memory after first load.
    """
    global _catalog_cache
    if _catalog_cache is not None:
        return _catalog_cache

    data_path = None
    for p in CATALOG_PATHS:
        if p.exists():
            data_path = p
            break

    if not data_path:
        print("[WARN] No all_courses.json found. Catalog will be empty.")
        _catalog_cache = []
        return _catalog_cache

    with open(data_path) as f:
        _catalog_cache = json.load(f)

    print(f"[OK] Loaded {len(_catalog_cache)} catalog courses from {data_path}")
    return _catalog_cache


def lookup_rating(
    instructor: str,
    ratings: dict[str, ProfessorRating],
) -> ProfessorRating | None:
    """Look up a professor rating by instructor name string.

    Uses normalized fuzzy matching: tries exact normalized match first,
    then falls back to surname-only matching.
    """
    if not instructor or instructor.upper() == "TBA" or not ratings:
        return None

    # Try exact normalized match
    key = normalize_name_key(instructor)
    if key in ratings:
        return ratings[key]

    # Try just the last name (first word before comma/space)
    # "DONG, Qingkai" → try "dong"
    parts = instructor.replace(",", " ").split()
    if parts:
        last = parts[0].lower()
        if last in ratings:
            return ratings[last]

    # Try each part in case of concatenated names
    # "SONG, XueyangYANG, Sen" → try "song", "xueyang", "yang", "sen"
    for part in parts:
        clean = part.strip().lower()
        if len(clean) >= 2 and clean in ratings:
            return ratings[clean]

    return None
