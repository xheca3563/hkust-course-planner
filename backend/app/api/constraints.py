"""User constraint presets and validation API."""

from fastapi import APIRouter

from app.models.schemas import UserConstraint

router = APIRouter()

# Predefined constraint presets
PRESETS = {
    "relaxed": UserConstraint(
        avoid_noon_back_to_back=False,
        no_evening_classes=False,
        min_break_minutes=0,
    ),
    "standard": UserConstraint(
        avoid_noon_back_to_back=True,
        no_evening_classes=False,
        min_break_minutes=10,
    ),
    "strict": UserConstraint(
        avoid_noon_back_to_back=True,
        no_evening_classes=True,
        evening_cutoff="18:00",
        min_break_minutes=30,
        preferred_start_time="09:00",
        preferred_end_time="18:00",
    ),
}


@router.get("/presets", response_model=dict[str, UserConstraint])
async def get_presets():
    """Get predefined constraint presets."""
    return PRESETS
