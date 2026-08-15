"""Pydantic data models for EaglePlan."""

from enum import StrEnum
from typing import Optional

from pydantic import BaseModel


class DayOfWeek(StrEnum):
    MON = "Mon"
    TUE = "Tue"
    WED = "Wed"
    THU = "Thu"
    FRI = "Fri"
    SAT = "Sat"
    SUN = "Sun"


class Term(StrEnum):
    FALL = "Fall"
    SPRING = "Spring"
    SUMMER = "Summer"


class TimeSlot(BaseModel):
    """A single time slot for a class meeting."""
    day: DayOfWeek
    start_time: str  # "HH:MM" format, e.g. "10:30"
    end_time: str    # "HH:MM" format, e.g. "11:50"
    venue: str = ""


class Section(BaseModel):
    """A class section (lecture, tutorial, or lab)."""
    section_id: str
    section_type: str  # "L" (lecture), "T" (tutorial), "LA" (lab)
    course_code: str
    instructor: str
    time_slots: list[TimeSlot]
    quota: int = 0
    enrol: int = 0
    remarks: str = ""


class CourseBrief(BaseModel):
    """Lightweight course info without sections — for list views."""
    code: str
    title: str
    credits: int
    school: str = ""
    department: str = ""
    description: str = ""
    prerequisites: str = ""
    corequisites: str = ""
    exclusions: str = ""
    rating: Optional[float] = None


class Course(CourseBrief):
    """A course with its metadata, prerequisites, and sections."""
    sections: list[Section] = []


class ProfessorRating(BaseModel):
    """Professor rating data from UST Rankings (ust-rankings.com).

    overall_grade uses UST Rankings' exact default score formula (6 criteria,
    weighted: content 26.7%, teaching 26.7%, grading 10%, workload 3.3%,
    course 8.3%, instructor 25%). All grades are percentile-ranked across
    all rated HKUST instructors using UST Rankings' exact letter-grade
    thresholds (extracted from their rendering source code):

        percentile ≥ 0.90 → A+    percentile ≥ 0.25 → C
        percentile ≥ 0.80 → A     percentile ≥ 0.20 → C-
        percentile ≥ 0.75 → A-    percentile ≥ 0.10 → D
        percentile ≥ 0.60 → B+    percentile ≥ 0.00 → F
        percentile ≥ 0.45 → B
        percentile ≥ 0.35 → B-
        percentile ≥ 0.30 → C+

    Percentile computed as: 1 - rank_from_best / total (UST Rankings method).

    teaching_grade = teaching criterion bayesian z-score percentile.
    grading_grade = grading criterion bayesian z-score percentile.
    """
    name: str
    school: str = ""
    overall_grade: str = ""     # UST Rankings formula: A+ to F
    overall_gpa: float = 0.0    # GPA equivalent: 4.3 (A+) to 0.0 (F)
    teaching_grade: str = ""    # teaching criterion percentile
    teaching_gpa: float = 0.0
    grading_grade: str = ""     # grading criterion percentile
    grading_gpa: float = 0.0
    review_count: int = 0
    source: str = ""            # "ustrankings", "ustspace", "sfq"
    latest_term: str = ""       # e.g. "2025-26 Summer"


class UserConstraint(BaseModel):
    """User-defined scheduling constraints."""
    avoid_noon_back_to_back: bool = False
    noon_start: str = "11:00"
    noon_end: str = "14:00"
    no_evening_classes: bool = False
    evening_cutoff: str = "18:00"
    day_off: Optional[DayOfWeek] = None
    avoided_instructors: list[str] = []
    min_professor_rating: float = 0.0  # 0 = no filter
    preferred_start_time: str = ""  # earliest start, e.g. "09:00"
    preferred_end_time: str = ""    # latest end, e.g. "18:00"
    max_consecutive_hours: int = 0  # 0 = no limit


class ScheduleRequest(BaseModel):
    """Request body for smart schedule generation."""
    course_codes: list[str]
    term: Term
    constraints: UserConstraint


class ScheduleStats(BaseModel):
    """Statistics for a generated schedule."""
    days_with_classes: int = 0
    earliest_start: str = ""
    latest_end: str = ""
    total_hours: float = 0.0
    total_gap_hours: float = 0.0


class ScheduleResult(BaseModel):
    """A generated schedule result."""
    id: str
    sections: list[Section]
    stats: ScheduleStats = ScheduleStats()
    conflicts: list[str] = []


class Program(BaseModel):
    """A degree program with its requirements."""
    program_code: str
    program_name: str
    school: str
    total_credits_required: int
    requirements: list[dict]  # Flexible requirement structure


class StudentProgress(BaseModel):
    """Student's academic progress."""
    completed_courses: list[str] = []
    current_program: Optional[str] = None
    enrolled_term: Optional[str] = None
    credits_completed: int = 0
    courses_remaining: list[str] = []
    requirements_met: dict[str, bool] = {}
