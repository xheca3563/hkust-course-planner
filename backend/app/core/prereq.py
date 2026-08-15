"""Prerequisite checking engine using expression trees.

HKUST prerequisites are expressed with:
- AND: represented by & or the word "AND"
- OR: represented by / or the word "OR"
- Commas: generally AND, but OR when introduced by "one of" / "any of" / "either"
- Course codes as leaf nodes
- Grade requirements (e.g., "C- or above") — stripped, student admitted
- HKDSE/IELTS clauses — stripped, assumed satisfied
- Date qualifiers: "(prior to 2022-23)" — stripped
- Level ranges: "any COMP courses of 3000-level or above" — LEVEL node

Examples:
    "COMP 2012" — single prerequisite
    "COMP 2011 & COMP 2012" — both required
    "COMP 2011 / COMP 2012H" — either one
    "COMP 2011 AND COMP 2012" — word-form AND
    "ACCT 5100 OR ACCT 5150" — word-form OR
    "One of ISOM 2500, MATH 2411 or MATH 3423" — OR group

The engine parses prerequisite strings into expression trees
and evaluates them against a student's completed courses.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Any


@dataclass
class PrereqNode:
    """A node in the prerequisite expression tree."""

    type: str  # "AND", "OR", "COURSE", "GRADE", "LEVEL"
    value: str = ""
    children: list[PrereqNode] = field(default_factory=list)

    def evaluate(self, completed_courses: list[str]) -> tuple[bool, list[str]]:
        """
        Evaluate this node against completed courses.
        Returns (satisfied, list_of_missing_courses).
        """
        if self.type == "COURSE":
            code_upper = self.value.upper()
            satisfied = code_upper in [c.upper() for c in completed_courses]
            return (satisfied, [] if satisfied else [self.value])

        elif self.type == "LEVEL":
            # "any COMP courses of 3000-level or above"
            # self.value = "COMP", children = [min_level_node]
            prefix = self.value.upper()
            min_level = int(self.children[0].value) if self.children else 3000
            matching = [
                c
                for c in completed_courses
                if c.upper().startswith(prefix + " ")
                and self._course_level(c) >= min_level
            ]
            if matching:
                return (True, [])
            return (False, [f"One {prefix} course at {min_level}-level or above"])

        elif self.type == "AND":
            missing = []
            all_satisfied = True
            for child in self.children:
                child_sat, child_missing = child.evaluate(completed_courses)
                if not child_sat:
                    all_satisfied = False
                    missing.extend(child_missing)
            return (all_satisfied, missing)

        elif self.type == "OR":
            all_missing = []
            for child in self.children:
                child_sat, child_missing = child.evaluate(completed_courses)
                if child_sat:
                    return (True, [])
                all_missing.extend(child_missing)
            alternatives = " / ".join([c.value for c in self.children])
            return (False, [f"({alternatives})"])

        elif self.type == "GRADE":
            # Grade requirements - simplified: just check if course was completed
            return (
                self.children[0].evaluate(completed_courses)
                if self.children
                else (True, [])
            )

        return (True, [])

    @staticmethod
    def _course_level(code: str) -> int:
        """Extract course level from code like 'COMP 3012' -> 3000."""
        match = re.search(r"(\d{4})", code)
        if match:
            return (int(match.group(1)) // 1000) * 1000
        return 0


# ── Normalization ──────────────────────────────────────────────


# Patterns for cleaning prerequisite strings before parsing
_DATE_QUALIFIER_RE = re.compile(
    r"\(\s*(prior|before|after|from)\s+[^)]+\)", re.IGNORECASE
)
_HKDSE_CLAUSE_RE = re.compile(
    r"Level\s+\d\*?\s*(or\s+above)?\s*in\s+HKDSE[^)]*(?=[)/&]|$)",
    re.IGNORECASE,
)
_IELTS_CLAUSE_RE = re.compile(
    r"Overall\s+bandscore\s+of\s+[\d.]+\s*in\s+IELTS[^)]*(?=[)/&]|$)",
    re.IGNORECASE,
)
_GRADE_PREFIX_RE = re.compile(
    r"[Gg]rade\s+[A-D][+-]?\s*(or\s+above)?\s*in\s+",
)
_EQUIVALENT_RE = re.compile(
    r"\s*(,?\s*(?:or|OR)\s+)?[Ee]quivalent\s*\.?\s*",
)
_TRAILING_OR_RE = re.compile(r"\s+(?:OR|or)\s*$")
_OR_EQUIVALENCE_RE = re.compile(
    r"\s+OR\s+equivalence\s+of\s+the\s+above\b", re.IGNORECASE
)
_AL_PURE_RE = re.compile(
    r"[Gg]rade\s+[A-D]\s+in\s+AL\s+[^;]*;", re.IGNORECASE
)
_SEMICOLON_SEPARATED = re.compile(r";\s*(?=[A-Z(])")  # split different cohort rules


def normalize_prereq_string(text: str) -> str:
    """Normalize a HKUST prerequisite string into a standard form
    using & / ( ) operators and course codes only.

    Returns the normalized string and a confidence level.
    """
    if not text or not text.strip():
        return ""

    t = text.strip()

    # 1. Strip semicolon-separated sections — keep the most inclusive
    #    e.g. "(For DDP) X; (For all others) Y" → "X / Y"
    if ";" in t and not re.search(r"[&/]", t):
        # Simple case: just a semicolon in a non-operator string
        pass  # handled by later steps

    # 2. Remove date qualifier parentheticals
    #    "(prior to 2022-23)", "(Prior to 2025-26)", "(Prior to 2022-23)"
    t = _DATE_QUALIFIER_RE.sub("", t)

    # 3. Remove HKDSE/IELTS clauses — admitted students have met these
    #    But only if they're standalone clauses (not inside course requirements)
    t = _HKDSE_CLAUSE_RE.sub("", t)
    t = _IELTS_CLAUSE_RE.sub("", t)
    t = _OR_EQUIVALENCE_RE.sub("", t)

    # 4. Handle "One of X, Y, Z" / "One of X OR Y" patterns
    #    → convert to (X / Y / Z)
    one_of_match = re.match(
        r"(One|Any|Either)\s+of\s+(.+)$", t, re.IGNORECASE
    )
    if one_of_match:
        rest = one_of_match.group(2)
        # Replace "or" with "/" in the rest, then split on comma and / to get courses
        rest = re.sub(r"\s+or\s+", " / ", rest, flags=re.IGNORECASE)
        rest = re.sub(r"\s*,\s*", " / ", rest)
        t = f"({rest})"

    # 5. Convert word-form AND/OR to symbols
    #    " AND " → " & " (but be careful with "and" inside course names)
    t = re.sub(r"\s+AND\s+", " & ", t, flags=re.IGNORECASE)

    # 6. Clean up: remove leftover HKDSE/grade fragments
    #    "Level 3 or above in HKDSE 1x Biology" → remove
    t = re.sub(r"Level\s+\d\*?\s*(or\s+above)?\s*in\s+HKDSE[^)]*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"Level\s+\d\*?\s*(or\s+above)?\s*in\s+HKDSE[^)/&]*", "", t, flags=re.IGNORECASE)

    # 7. Handle comma-separated lists (that aren't part of One-of)
    #    "FINA 5120, FINA 5210 and FINA 5290" → "FINA 5120 & FINA 5210 & FINA 5290"
    #    But only if there's no & or / already present
    if "," in t and "/" not in t:
        t = re.sub(r"\s+and\s+", " & ", t, flags=re.IGNORECASE)
        t = re.sub(r"\s*,\s*", " & ", t)

    # 8. Clean up "or Equivalent" / "or equivalence of the above"
    t = _EQUIVALENT_RE.sub("", t)
    t = re.sub(r"\s+or\s+equivalence\s+of\s+the\s+above\b\.?", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s+or\s+equivalent\b\.?", "", t, flags=re.IGNORECASE)

    # 9. Remove grade prefixes: "Grade A- or above in MATH 1014" → "MATH 1014"
    t = _GRADE_PREFIX_RE.sub("", t)

    # 10. Remove grade-only parentheticals like "(grade A- or above in MATH 1003)"
    t = re.sub(
        r"\(\s*grade\s+[A-D][+-]?\s*(or\s+above)?\s*in\s+([A-Z]{2,4}\s+\d{4}[A-Z]?)\s*\)",
        r"\2",
        t,
        flags=re.IGNORECASE,
    )

    # 11. Handle AL Pure Math clauses
    t = _AL_PURE_RE.sub("", t)

    # 12. Clean up OR (word) → / — but only when it appears as a standalone word
    #     between course patterns (not inside course titles)
    t = re.sub(r"\s+OR\s+", " / ", t, flags=re.IGNORECASE)

    # 13. Remove trailing "OR" / "or" left over from Equivalent stripping
    t = _TRAILING_OR_RE.sub("", t)

    # 14. Remove orphaned parentheses and extra whitespace
    t = re.sub(r"\(\s*\)", "", t)  # empty parens
    t = re.sub(r"\s+", " ", t).strip()

    # 14. Remove leading/trailing operators
    t = re.sub(r"^[&/]\s*", "", t)
    t = re.sub(r"\s*[&/]$", "", t)

    # 15. Balance parentheses: remove unmatched
    open_count = t.count("(")
    close_count = t.count(")")
    if open_count > close_count:
        t += ")" * (open_count - close_count)
    elif close_count > open_count:
        t = "(" * (close_count - open_count) + t

    # 16. Clean up double operators
    t = re.sub(r"\s*&\s*&\s*", " & ", t)
    t = re.sub(r"\s*/\s*/\s*", " / ", t)

    return t.strip()


# ── Parser ──────────────────────────────────────────────────────


class PrerequisiteParser:
    """Parses HKUST prerequisite strings into expression trees.

    Grammar (simplified):
        expr    := term ("/" term)*          # OR
        term    := factor ("&" factor)*       # AND
        factor  := course_code | level_range | "(" expr ")"

    Course code pattern: [A-Z]{2,4}\s*[0-9]{4}[A-Z]?
    Level range: "any" [A-Z]{2,4} "courses of" [0-9]000 "-level or above"
    """

    COURSE_PATTERN = re.compile(
        r"([A-Z]{2,4})\s*([0-9]{4})([A-Z]?)", re.IGNORECASE
    )
    LEVEL_PATTERN = re.compile(
        r"(?:any|all)\s+([A-Z]{2,4})\s+courses?\s+(?:of|at)\s+(\d)000\s*-?\s*level\s*(?:or\s+above)?",
        re.IGNORECASE,
    )

    def __init__(self):
        self._confidence: str = "exact"

    def parse(self, prereq_str: str) -> PrereqNode:
        """Parse a prerequisite string into an expression tree."""
        self._confidence = "exact"

        if not prereq_str or prereq_str.strip() == "":
            return PrereqNode(type="AND")  # No prerequisites = always satisfied

        # Normalize first
        original = prereq_str.strip()
        text = normalize_prereq_string(original)
        self._confidence = self._compute_confidence(original, text)

        tokens = self._tokenize(text)
        if not tokens:
            return PrereqNode(type="AND")

        try:
            node, _ = self._parse_expr(tokens, 0)
        except Exception:
            # Fall back if parsing fails
            return PrereqNode(type="AND")

        return node

    @property
    def confidence(self) -> str:
        """Return confidence level of the last parse: "exact" | "partial" | "unknown"."""
        return self._confidence

    def _compute_confidence(self, original: str, normalized: str) -> str:
        """Determine how confident we are in the normalized result."""
        # After normalization, check if any non-course tokens remain
        remaining = normalized
        # Remove all course codes
        remaining = self.COURSE_PATTERN.sub("", remaining)
        # Remove operators and parens
        remaining = re.sub(r"[&/()]", "", remaining)
        remaining = remaining.strip()

        if not remaining:
            return "exact"

        # Check if remaining text looks like something we couldn't parse
        if re.search(r"[A-Za-z]{3,}", remaining):
            return "partial"

        return "exact"

    def _tokenize(self, text: str) -> list[tuple[str, str]]:
        """Tokenize prerequisite string."""
        tokens = []
        i = 0
        while i < len(text):
            if text[i] in "()":
                tokens.append(("PAREN", text[i]))
                i += 1
            elif text[i] == "&":
                tokens.append(("AND", "&"))
                i += 1
            elif text[i] == "/":
                tokens.append(("OR", "/"))
                i += 1
            elif text[i].isspace():
                i += 1
            else:
                # Try to match a level range
                lvl_match = self.LEVEL_PATTERN.match(text, i)
                if lvl_match:
                    prefix = lvl_match.group(1).upper()
                    lvl = int(lvl_match.group(2)) * 1000
                    tokens.append(("LEVEL", prefix))
                    tokens.append(("LEVEL_VAL", str(lvl)))
                    i = lvl_match.end()
                    continue

                # Try to match a course code
                match = self.COURSE_PATTERN.match(text, i)
                if match:
                    code = (
                        f"{match.group(1).upper()} {match.group(2)}{match.group(3)}"
                    )
                    tokens.append(("COURSE", code))
                    i = match.end()
                else:
                    # Skip unrecognized token
                    j = i
                    while j < len(text) and text[j] not in "()&/ ":
                        j += 1
                    word = text[i:j].strip()
                    if word and self.COURSE_PATTERN.search(word):
                        # It contains a course code — try to extract it
                        cm = self.COURSE_PATTERN.search(word)
                        if cm:
                            code = f"{cm.group(1).upper()} {cm.group(2)}{cm.group(3)}"
                            tokens.append(("COURSE", code))
                    i = j

        return tokens

    def _parse_expr(self, tokens: list, pos: int) -> tuple[PrereqNode, int]:
        """Parse expression: term ('/' term)*"""
        left, pos = self._parse_term(tokens, pos)

        while pos < len(tokens) and tokens[pos][0] == "OR":
            pos += 1  # consume '/'
            right, pos = self._parse_term(tokens, pos)

            if left.type == "OR":
                left.children.append(right)
            else:
                left = PrereqNode(type="OR", children=[left, right])

        return (left, pos)

    def _parse_term(self, tokens: list, pos: int) -> tuple[PrereqNode, int]:
        """Parse term: factor ('&' factor)*"""
        left, pos = self._parse_factor(tokens, pos)

        while pos < len(tokens) and tokens[pos][0] == "AND":
            pos += 1  # consume '&'
            right, pos = self._parse_factor(tokens, pos)

            if left.type == "AND":
                left.children.append(right)
            else:
                left = PrereqNode(type="AND", children=[left, right])

        return (left, pos)

    def _parse_factor(self, tokens: list, pos: int) -> tuple[PrereqNode, int]:
        """Parse factor: course_code | level_range | '(' expr ')'"""
        if pos >= len(tokens):
            return (PrereqNode(type="AND"), pos)

        token_type, token_value = tokens[pos]

        if token_type == "PAREN" and token_value == "(":
            pos += 1
            node, pos = self._parse_expr(tokens, pos)
            if pos < len(tokens) and tokens[pos][1] == ")":
                pos += 1
            return (node, pos)

        elif token_type == "COURSE":
            pos += 1
            return (PrereqNode(type="COURSE", value=token_value), pos)

        elif token_type == "LEVEL":
            prefix = token_value
            pos += 1
            min_level = "3000"
            if pos < len(tokens) and tokens[pos][0] == "LEVEL_VAL":
                min_level = tokens[pos][1]
                pos += 1
            return (
                PrereqNode(
                    type="LEVEL",
                    value=prefix,
                    children=[PrereqNode(type="COURSE", value=min_level)],
                ),
                pos,
            )

        else:
            pos += 1
            return (PrereqNode(type="AND"), pos)


# ── Engine ──────────────────────────────────────────────────────


class PrerequisiteEngine:
    """Main engine for checking prerequisite satisfaction."""

    def __init__(self):
        self.parser = PrerequisiteParser()
        self._prereq_cache: dict[str, PrereqNode] = {}
        self._confidence_cache: dict[str, str] = {}

    def check(
        self, course_code: str, completed_courses: list[str]
    ) -> dict[str, Any]:
        """
        Check if prerequisites are satisfied for a course.

        Returns:
        {
            "satisfied": bool,
            "missing": [str],
            "prereq_raw": str,
            "explanation": str,
            "confidence": "exact" | "partial" | "unknown",
        }
        """
        from app.api.courses import _COURSES

        course = _COURSES.get(course_code.upper())

        if not course:
            return {
                "satisfied": False,
                "missing": [course_code],
                "prereq_raw": "",
                "explanation": f"Course {course_code} not found in database",
                "confidence": "unknown",
            }

        prereq_str = course.prerequisites
        if not prereq_str:
            return {
                "satisfied": True,
                "missing": [],
                "prereq_raw": "",
                "explanation": "No prerequisites required",
                "confidence": "exact",
            }

        # Parse and evaluate
        if course_code not in self._prereq_cache:
            self._prereq_cache[course_code] = self.parser.parse(prereq_str)
            self._confidence_cache[course_code] = self.parser.confidence

        tree = self._prereq_cache[course_code]
        satisfied, missing = tree.evaluate(completed_courses)

        return {
            "satisfied": satisfied,
            "missing": missing,
            "prereq_raw": prereq_str,
            "explanation": (
                "All prerequisites satisfied"
                if satisfied
                else f"Missing: {', '.join(missing)}"
            ),
            "confidence": self._confidence_cache.get(course_code, "exact"),
        }

    def check_exclusion(
        self, course_code: str, completed_courses: list[str]
    ) -> dict[str, Any]:
        """
        Check if a completed course appears in this course's exclusions list.
        Exclusion lists use comma-separated alternatives plus optional date qualifiers.
        Returns: { "conflict": bool, "conflicting_course": str|null, "exclusion_raw": str }
        """
        from app.api.courses import _COURSES

        course = _COURSES.get(course_code.upper())
        if not course or not course.exclusions:
            return {
                "conflict": False,
                "conflicting_course": None,
                "exclusion_raw": "",
            }

        exclusions_raw = course.exclusions

        # Parse exclusion list: comma or "and"/"or" separated course codes
        # Clean date qualifiers
        cleaned = _DATE_QUALIFIER_RE.sub("", exclusions_raw)
        # Split on commas and "and"/"or"
        parts = re.split(r"\s*,\s*|\s+and\s+|\s+or\s+", cleaned, flags=re.IGNORECASE)
        excluded_codes = []
        level_patterns = []  # (prefix, min_level)

        for part in parts:
            part = part.strip()
            if not part:
                continue
            # Check for level range
            lvl_match = re.match(
                r"(?:any|all)\s+([A-Z]{2,4})\s+courses?\s+(?:of|at)\s+(\d)000\s*-?\s*level\s*(?:or\s+above)?",
                part,
                re.IGNORECASE,
            )
            if lvl_match:
                level_patterns.append(
                    (lvl_match.group(1).upper(), int(lvl_match.group(2)) * 1000)
                )
                continue
            # Extract course code
            cm = self.parser.COURSE_PATTERN.search(part)
            if cm:
                code = f"{cm.group(1).upper()} {cm.group(2)}{cm.group(3)}"
                excluded_codes.append(code)

        completed_upper = [c.upper() for c in completed_courses]

        # Check exact codes
        for ec in excluded_codes:
            if ec in completed_upper:
                return {
                    "conflict": True,
                    "conflicting_course": ec,
                    "exclusion_raw": exclusions_raw,
                }

        # Check level patterns
        for prefix, min_lvl in level_patterns:
            for cc in completed_upper:
                if cc.startswith(prefix + " "):
                    lvl = PrereqNode._course_level(cc)
                    if lvl >= min_lvl:
                        return {
                            "conflict": True,
                            "conflicting_course": cc,
                            "exclusion_raw": exclusions_raw,
                        }

        return {
            "conflict": False,
            "conflicting_course": None,
            "exclusion_raw": exclusions_raw,
        }

    def check_corequisite(
        self, course_code: str, selected_courses: list[str]
    ) -> dict[str, Any]:
        """
        Check if corequisites are met by the set of selected + completed courses.
        Corequisites are courses that must be taken concurrently.
        """
        from app.api.courses import _COURSES

        course = _COURSES.get(course_code.upper())
        if not course or not course.corequisites:
            return {
                "satisfied": True,
                "missing": [],
                "coreq_raw": "",
            }

        coreq_str = course.corequisites
        # Coreq strings follow the same pattern as prereqs
        tree = self.parser.parse(coreq_str)
        satisfied, missing = tree.evaluate(selected_courses)

        return {
            "satisfied": satisfied,
            "missing": missing,
            "coreq_raw": coreq_str,
        }

    def check_all(
        self,
        course_code: str,
        completed_courses: list[str],
        selected_courses: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Full check: prerequisites, corequisites, and exclusions for a course.

        Returns:
        {
            "course_code": str,
            "prereq_satisfied": bool,
            "prereq_missing": [str],
            "prereq_raw": str,
            "coreq_satisfied": bool,
            "coreq_missing": [str],
            "exclusion_conflict": bool,
            "conflicting_course": str|null,
            "exclusion_raw": str,
            "confidence": str,
            "needs_waiver": [str],
        }
        """
        all_selected = list(completed_courses)
        if selected_courses:
            all_selected.extend(selected_courses)

        prereq = self.check(course_code, completed_courses)
        coreq = self.check_corequisite(course_code, all_selected)
        excl = self.check_exclusion(course_code, completed_courses)

        needs_waiver = []
        if not prereq["satisfied"]:
            needs_waiver = prereq["missing"]

        return {
            "course_code": course_code,
            "prereq_satisfied": prereq["satisfied"],
            "prereq_missing": prereq["missing"],
            "prereq_raw": prereq["prereq_raw"],
            "coreq_satisfied": coreq["satisfied"],
            "coreq_missing": coreq["missing"],
            "coreq_raw": coreq["coreq_raw"],
            "exclusion_conflict": excl["conflict"],
            "conflicting_course": excl["conflicting_course"],
            "exclusion_raw": excl["exclusion_raw"],
            "confidence": prereq.get("confidence", "exact"),
            "needs_waiver": needs_waiver,
        }
