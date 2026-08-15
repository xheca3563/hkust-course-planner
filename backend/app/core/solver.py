"""Schedule generation engine using constraint satisfaction.

Given a list of course codes and user constraints, generates all valid
timetable combinations. Uses backtracking with constraint propagation
to efficiently prune invalid branches.

Core algorithm:
    1. For each course, collect all sections (L + T + LA)
    2. Group sections by course
    3. Backtrack: for each course, try each section combo
    4. At each step, check: time overlap, user constraints
    5. Collect all valid complete assignments
"""

import itertools
from datetime import datetime, timedelta

from app.models.schemas import (
    Course,
    DayOfWeek,
    ScheduleRequest,
    ScheduleResult,
    ScheduleStats,
    Section,
    Term,
    TimeSlot,
    UserConstraint,
)


# In-memory ratings store (populated by main.py lifespan)
from app.core.data_loader import lookup_rating as _lookup_rating_func


def _time_to_minutes(time_str: str) -> int:
    """Convert 'HH:MM' to minutes since midnight."""
    parts = time_str.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def _slots_overlap(a: TimeSlot, b: TimeSlot) -> bool:
    """Check if two time slots overlap in time on the same day."""
    if a.day != b.day:
        return False
    a_start = _time_to_minutes(a.start_time)
    a_end = _time_to_minutes(a.end_time)
    b_start = _time_to_minutes(b.start_time)
    b_end = _time_to_minutes(b.end_time)
    return a_start < b_end and b_start < a_end


def _has_noon_back_to_back(slots: list[TimeSlot], noon_start: str, noon_end: str) -> bool:
    """
    Check if schedule has NO 30-minute free gap during the noon period.
    New definition: 11:00-14:00 must have at least 30 contiguous minutes free.
    Returns True if constraint is VIOLATED (no 30-min free slot in noon period).
    """
    noon_start_min = _time_to_minutes(noon_start)   # default 11:00 = 660
    noon_end_min = _time_to_minutes(noon_end)        # default 14:00 = 840
    gap_needed = 30  # minutes

    for day in DayOfWeek:
        day_slots = sorted(
            [s for s in slots if s.day == day],
            key=lambda s: _time_to_minutes(s.start_time),
        )
        if not day_slots:
            continue  # no classes on this day → has free time

        # Check gap before first class
        first_start = _time_to_minutes(day_slots[0].start_time)
        if first_start - noon_start_min >= gap_needed:
            continue  # has enough morning gap, day is fine

        # Check gaps between classes
        has_gap = False
        for i in range(len(day_slots)):
            s_start = _time_to_minutes(day_slots[i].start_time)
            s_end = _time_to_minutes(day_slots[i].end_time)

            # Gap before this class (within noon period)
            if i == 0:
                prev_end = noon_start_min
            else:
                prev_end = _time_to_minutes(day_slots[i - 1].end_time)

            gap_start = max(prev_end, noon_start_min)
            gap_end = min(s_start, noon_end_min)
            if gap_end - gap_start >= gap_needed:
                has_gap = True
                break

        if not has_gap:
            # Check gap after last class
            last_end = _time_to_minutes(day_slots[-1].end_time)
            if noon_end_min - max(last_end, noon_start_min) >= gap_needed:
                has_gap = True

        if not has_gap:
            return True  # violation!

    return False


class ScheduleSolver:
    """Generates all valid schedules given courses and constraints."""

    def __init__(self):
        self._courses: dict[str, Course] = {}

    def solve(
        self,
        course_codes: list[str],
        term: Term,
        constraints: UserConstraint,
        max_results: int = 50,
    ) -> list[ScheduleResult]:
        """Generate all valid schedules and return ranked results."""
        # Collect all sections for each course
        course_sections: dict[str, list[list[Section]]] = {}
        for code in course_codes:
            course = self._load_course(code)
            if not course:
                continue
            # Group sections by type (L, T, LA) - each course needs one of each type
            by_type: dict[str, list[Section]] = {}
            for sec in course.sections:
                by_type.setdefault(sec.section_type, []).append(sec)

            # Generate all combinations: pick 1 from each type
            section_types = list(by_type.keys())
            if section_types:
                combos = list(itertools.product(*(by_type[t] for t in section_types)))
                course_sections[code] = [
                    list(combo) for combo in combos
                ]
            else:
                course_sections[code] = [[]]

        # Backtracking search
        valid_schedules: list[list[Section]] = []

        def backtrack(
            idx: int,
            current: list[Section],
            course_list: list[str],
        ):
            if idx >= len(course_list):
                # All courses assigned -> found a valid schedule
                valid_schedules.append(list(current))
                if len(valid_schedules) >= max_results:
                    return True  # signal to stop
                return False

            code = course_list[idx]
            combos = course_sections.get(code, [])
            for combo in combos:
                # Check constraints with current assignment
                all_slots = []
                for sec in current + list(combo):
                    all_slots.extend(sec.time_slots)

                if self._check_constraints(all_slots, constraints, current + list(combo)):
                    current.extend(combo)
                    if backtrack(idx + 1, current, course_list):
                        return True
                    # Backtrack
                    for _ in combo:
                        current.pop()
            return False

        backtrack(0, [], list(course_sections.keys()))

        # Build results in generation order (no scoring/ranking — all valid
        # schedules are returned as found)
        results = []
        for i, sections in enumerate(valid_schedules):
            all_slots = [s for sec in sections for s in sec.time_slots]
            stats = self._compute_stats(all_slots)
            results.append(ScheduleResult(
                id=f"schedule_{i+1}",
                sections=sections,
                stats=stats,
            ))
        return results

    def _check_constraints(
        self, all_slots: list[TimeSlot], constraints: UserConstraint,
        sections: list = None,
    ) -> bool:
        """Check all applied constraints against current slot assignment."""

        # 1. No time overlaps
        for i in range(len(all_slots)):
            for j in range(i + 1, len(all_slots)):
                if _slots_overlap(all_slots[i], all_slots[j]):
                    return False

        # 2. No evening classes
        if constraints.no_evening_classes:
            cutoff = _time_to_minutes(constraints.evening_cutoff)
            for s in all_slots:
                if _time_to_minutes(s.end_time) > cutoff:
                    return False

        # 3. Day off
        if constraints.day_off:
            day_slots = [s for s in all_slots if s.day == constraints.day_off]
            if day_slots:
                return False

        # 4. No noon back-to-back
        if constraints.avoid_noon_back_to_back:
            if _has_noon_back_to_back(
                all_slots,
                constraints.noon_start,
                constraints.noon_end,
            ):
                return False

        # 5. Preferred start/end times
        if constraints.preferred_start_time:
            earliest = _time_to_minutes(constraints.preferred_start_time)
            for s in all_slots:
                if _time_to_minutes(s.start_time) < earliest:
                    return False
        if constraints.preferred_end_time:
            latest = _time_to_minutes(constraints.preferred_end_time)
            for s in all_slots:
                if _time_to_minutes(s.end_time) > latest:
                    return False

        # 6. Avoided instructors
        if constraints.avoided_instructors and sections:
            from app.api.ratings import _RATINGS
            avoided = {a.strip().lower() for a in constraints.avoided_instructors}
            for sec in sections:
                instructor_lower = sec.instructor.strip().lower() if hasattr(sec, 'instructor') else ""
                if instructor_lower and instructor_lower in avoided:
                    return False

        # 7. Minimum professor rating
        if constraints.min_professor_rating > 0 and sections:
            from app.api.ratings import _RATINGS
            for sec in sections:
                instructor = sec.instructor if hasattr(sec, 'instructor') else ""
                if not instructor or instructor.upper() == "TBA":
                    continue
                rating = _lookup_rating_func(instructor, _RATINGS)
                if rating and rating.overall_gpa > 0 and rating.overall_gpa < constraints.min_professor_rating:
                    return False

        return True

    def _compute_stats(self, all_slots: list[TimeSlot]) -> ScheduleStats:
        """Compute schedule statistics."""
        if not all_slots:
            return ScheduleStats()

        days = {s.day for s in all_slots}
        earliest = min(_time_to_minutes(s.start_time) for s in all_slots)
        latest = max(_time_to_minutes(s.end_time) for s in all_slots)

        total_minutes = sum(
            _time_to_minutes(s.end_time) - _time_to_minutes(s.start_time)
            for s in all_slots
        )

        gap_total = 0
        for day in DayOfWeek:
            day_slots = sorted(
                [s for s in all_slots if s.day == day],
                key=lambda s: _time_to_minutes(s.start_time),
            )
            for i in range(1, len(day_slots)):
                gap = _time_to_minutes(day_slots[i].start_time) - _time_to_minutes(
                    day_slots[i - 1].end_time
                )
                gap_total += gap

        def _fmt(m: int) -> str:
            return f"{m // 60:02d}:{m % 60:02d}"

        return ScheduleStats(
            days_with_classes=len(days),
            earliest_start=_fmt(earliest),
            latest_end=_fmt(latest),
            total_hours=round(total_minutes / 60, 1),
            total_gap_hours=round(gap_total / 60, 1),
        )

    def _load_course(self, code: str) -> Course | None:
        """Load course data. For now a placeholder."""
        # TODO: load from DB/JSON file
        from app.api.courses import _COURSES
        return _COURSES.get(code.upper())
