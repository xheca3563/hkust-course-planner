"""Professor rating API endpoints."""

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import ProfessorRating
from app.core.data_loader import lookup_rating

router = APIRouter()

# In-memory ratings store (populated at startup by main.py lifespan)
_RATINGS: dict[str, ProfessorRating] = {}


@router.get("/{professor_name}", response_model=ProfessorRating | dict)
async def get_rating(professor_name: str):
    """Get rating for a specific professor by name."""
    rating = lookup_rating(professor_name, _RATINGS)
    if not rating:
        return {"name": professor_name, "found": False, "message": "No rating data available"}
    return rating


@router.get("/", response_model=dict)
async def batch_ratings(
    names: str = Query("", description="Comma-separated instructor names"),
):
    """Get ratings for multiple professors at once.

    GET /api/ratings/?names=DONG, Qingkai|CHAN, Tai Man
    """
    if not names:
        return {"ratings": {}, "total": len(_RATINGS)}

    # Use "|" as delimiter — instructor names contain commas ("LAST, First")
    name_list = [n.strip() for n in names.split("|") if n.strip()]
    results: dict[str, dict] = {}
    for name in name_list:
        rating = lookup_rating(name, _RATINGS)
        if rating:
            results[name] = rating.model_dump()
        else:
            results[name] = {"name": name, "found": False}

    return {"ratings": results, "matched": len([r for r in results.values() if r.get("found", True)])}


@router.get("/stats/summary")
async def ratings_summary():
    """Get summary statistics of available ratings."""
    if not _RATINGS:
        return {"total": 0, "average_gpa": 0, "sources": []}

    sources = list(set(r.source for r in _RATINGS.values() if r.source))
    with_grades = [r for r in _RATINGS.values() if r.overall_grade]

    return {
        "total": len(_RATINGS),
        "rated": len(with_grades),
        "average_gpa": (
            round(sum(r.overall_gpa for r in with_grades) / len(with_grades), 2)
            if with_grades else 0
        ),
        "sources": sources,
    }
