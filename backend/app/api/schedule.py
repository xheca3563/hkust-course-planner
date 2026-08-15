"""Schedule generation and management API endpoints."""

from fastapi import APIRouter, HTTPException

from app.models.schemas import ScheduleRequest, ScheduleResult

router = APIRouter()


@router.post("/generate", response_model=list[ScheduleResult])
async def generate_schedules(request: ScheduleRequest):
    """
    Smart schedule generation.

    Takes a list of desired course codes and user constraints,
    returns all valid schedule combinations.

    The solver:
    1. For each course, collects all sections
    2. Generates combinations avoiding time conflicts
    3. Filters by user constraints
    """
    from app.core.solver import ScheduleSolver

    solver = ScheduleSolver()
    results = solver.solve(
        course_codes=request.course_codes,
        term=request.term,
        constraints=request.constraints,
    )
    return results


@router.post("/validate", response_model=dict)
async def validate_schedule(sections: list[str]):
    """
    Validate a manually-built schedule for conflicts.
    Returns list of conflicts found, if any.
    """
    # TODO: implement validation logic
    return {"valid": True, "conflicts": []}
