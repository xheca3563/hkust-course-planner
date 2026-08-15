"""Course-related API endpoints."""

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import Course, CourseBrief, Section
from app.core.data_loader import load_course_catalog

router = APIRouter()


# In-memory store for now (will be replaced with DB/file-based storage)
_COURSES: dict[str, Course] = {}


@router.get("/schools", response_model=list[str])
async def list_schools():
    """List all available school codes."""
    return sorted(set(c.school for c in _COURSES.values() if c.school))


@router.get("/departments", response_model=dict[str, list[str]])
async def list_departments():
    """Return school → sorted list of unique department codes.
    Used by the frontend for major/minor dropdowns."""
    result: dict[str, set[str]] = {}
    for c in _COURSES.values():
        school = c.school or "Other"
        dept = c.department or "Other"
        if school not in result:
            result[school] = set()
        result[school].add(dept)
    return {school: sorted(depts) for school, depts in result.items()}


@router.get("/", response_model=list[CourseBrief])
async def list_courses(
    school: str | None = Query(None, description="Filter by school code"),
    level: int | None = Query(None, description="Filter by course level (1000-4000)"),
    search: str | None = Query(None, description="Search by code or title"),
):
    """List all available courses (brief — no sections for performance)."""
    results = list(_COURSES.values())

    if school:
        results = [c for c in results if c.school.upper() == school.upper()]
    if level:
        results = [c for c in results if int(c.code.split()[-1][0]) * 1000 == level]
    if search:
        q = search.lower()
        results = [c for c in results if q in c.code.lower() or q in c.title.lower()]

    return [
        CourseBrief(
            code=c.code,
            title=c.title,
            credits=c.credits,
            school=c.school,
            department=c.department,
            description=c.description,
            prerequisites=c.prerequisites,
            corequisites=c.corequisites,
            exclusions=c.exclusions,
            rating=c.rating,
        )
        for c in results
    ]


@router.get("/catalog", response_model=list[dict])
async def list_catalog():
    """Return the full course catalog (all years union).

    Each entry has code, title, credits, department.
    Used by the profile page for the completed-courses browser.
    """
    return load_course_catalog()


@router.get("/{course_code}", response_model=Course)
async def get_course(course_code: str):
    """Get detailed information about a specific course (with sections)."""
    course = _COURSES.get(course_code.upper())
    if not course:
        raise HTTPException(status_code=404, detail=f"Course {course_code} not found")
    return course


@router.get("/{course_code}/sections", response_model=list[Section])
async def get_course_sections(course_code: str):
    """Get all sections for a specific course."""
    course = _COURSES.get(course_code.upper())
    if not course:
        raise HTTPException(status_code=404, detail=f"Course {course_code} not found")
    return course.sections
