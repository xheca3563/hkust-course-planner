"""Academic progress tracking API endpoints."""

from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()


class CheckCoursesRequest(BaseModel):
    """Request body for batch prerequisite/co/exclusion check."""
    course_codes: list[str]
    completed: list[str] = []
    selected: list[str] = []  # courses being planned this term (for coreq check)


@router.post("/check-courses")
async def check_courses(req: CheckCoursesRequest):
    """
    Batch check prerequisites, corequisites, and exclusions
    for multiple courses against completed and currently-selected courses.

    Returns a list of per-course results with prereq/coreq/exclusion status.
    """
    from app.core.prereq import PrerequisiteEngine

    engine = PrerequisiteEngine()
    results = []
    for code in req.course_codes:
        result = engine.check_all(
            code,
            completed_courses=req.completed,
            selected_courses=req.selected if req.selected else None,
        )
        results.append(result)
    return results


@router.get("/check-prereq/{course_code}")
async def check_prerequisite(
    course_code: str,
    completed: str = "",  # comma-separated list of completed course codes
):
    """
    Check if prerequisite requirements are met for a single course.
    Returns whether the student can enroll, and what's missing.
    """
    from app.core.prereq import PrerequisiteEngine

    completed_list = [c.strip() for c in completed.split(",") if c.strip()]
    engine = PrerequisiteEngine()
    result = engine.check(course_code, completed_list)
    return result


class CalculateProgressRequest(BaseModel):
    """Request body for the graduation progress calculation."""

    program_code: str
    admit_year: str
    completed: list[str] = []
    selected: list[str] = []  # courses in the current timetable (projected)
    track: str | None = None  # track name for programs with track study


@router.post("/calculate")
async def calculate_progress(req: CalculateProgressRequest):
    """
    Full graduation progress report: Common Core (per admission cohort),
    program requirement groups, electives, free electives, and totals.
    """
    from app.core.progress import GraduationProgressEngine

    engine = GraduationProgressEngine()
    try:
        return engine.calculate(
            req.program_code.upper(),
            req.admit_year,
            req.completed,
            req.selected,
            req.track,
        )
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/programs")
async def list_progress_programs():
    """Programs with available requirement templates."""
    from app.core.progress import GraduationProgressEngine

    engine = GraduationProgressEngine()
    return engine.list_programs()


@router.get("/remaining")
async def get_remaining_requirements(
    program_code: str = "",
    completed: str = "",
    planned: str = "",
    admission_year: str = "",
    track: str = "",
):
    """
    Get graduation progress for a program.
    Thin wrapper over /calculate for comma-separated GET queries.
    """
    completed_list = [c.strip() for c in completed.split(",") if c.strip()]
    planned_list = [c.strip() for c in planned.split(",") if c.strip()]
    if not program_code or not admission_year:
        return {
            "program_code": program_code,
            "admission_year": admission_year,
            "estimated": True,
            "note": "Provide program_code and admission_year for a full report.",
        }
    from app.core.progress import GraduationProgressEngine

    engine = GraduationProgressEngine()
    try:
        report = engine.calculate(
            program_code.upper(), admission_year,
            completed_list, planned_list,
            track=track or None,
        )
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=404,
            detail=f"No requirement template for program {program_code}",
        )
    report["estimated"] = True
    return report
