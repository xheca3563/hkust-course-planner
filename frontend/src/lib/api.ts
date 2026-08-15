/** API client for CoursePlanner backend. */

import type { Course, ScheduleResult, Section, TimeSlot, ProfessorRating } from '@/types'

// In dev, Vite proxies /api to localhost:8000. In production, point
// VITE_API_URL at the deployed backend (e.g. https://xxx.onrender.com/api).
const BASE = import.meta.env.VITE_API_URL || '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

/* ── Normalization: snake_case (API) → camelCase (frontend) ── */

function normalizeTimeSlot(ts: Record<string, unknown>): TimeSlot {
  return {
    day: ts['day'] as TimeSlot['day'],
    startTime: (ts['start_time'] || ts['startTime'] || '') as string,
    endTime: (ts['end_time'] || ts['endTime'] || '') as string,
    venue: (ts['venue'] || '') as string,
  }
}

function normalizeSection(sec: Record<string, unknown>): Section {
  return {
    sectionId: (sec['section_id'] || sec['sectionId'] || '') as string,
    sectionType: (sec['section_type'] || sec['sectionType'] || 'L') as Section['sectionType'],
    courseCode: (sec['course_code'] || sec['courseCode'] || '') as string,
    instructor: (sec['instructor'] || 'TBA') as string,
    timeSlots: ((sec['time_slots'] || sec['timeSlots'] || []) as Record<string, unknown>[]).map(normalizeTimeSlot),
    quota: (sec['quota'] || 0) as number,
    enrol: (sec['enrol'] || 0) as number,
    remarks: (sec['remarks'] || '') as string,
  }
}

function normalizeCourse(raw: Record<string, unknown>): Course {
  return {
    code: (raw['code'] || '') as string,
    title: (raw['title'] || '') as string,
    credits: (raw['credits'] || 3) as number,
    school: (raw['school'] || '') as string,
    department: (raw['department'] || '') as string,
    description: (raw['description'] || '') as string,
    prerequisites: (raw['prerequisites'] || '') as string,
    corequisites: (raw['corequisites'] || '') as string,
    exclusions: (raw['exclusions'] || '') as string,
    sections: ((raw['sections'] || []) as Record<string, unknown>[]).map(normalizeSection),
    rating: raw['rating'] as number | undefined,
  }
}

function normalizeScheduleResult(raw: Record<string, unknown>): ScheduleResult {
  return {
    id: (raw['id'] || '') as string,
    sections: ((raw['sections'] || []) as Record<string, unknown>[]).map(normalizeSection),
    stats: {
      daysWithClasses: Number(
        (raw['stats'] as Record<string, unknown>)?.['days_with_classes']
        ?? (raw['stats'] as Record<string, unknown>)?.['daysWithClasses']
        ?? 0
      ),
      earliestStart: String(
        (raw['stats'] as Record<string, unknown>)?.['earliest_start']
        || (raw['stats'] as Record<string, unknown>)?.['earliestStart']
        || ''
      ),
      latestEnd: String(
        (raw['stats'] as Record<string, unknown>)?.['latest_end']
        || (raw['stats'] as Record<string, unknown>)?.['latestEnd']
        || ''
      ),
      totalHours: Number(
        (raw['stats'] as Record<string, unknown>)?.['total_hours']
        ?? (raw['stats'] as Record<string, unknown>)?.['totalHours']
        ?? 0
      ),
      totalGapHours: Number(
        (raw['stats'] as Record<string, unknown>)?.['total_gap_hours']
        ?? (raw['stats'] as Record<string, unknown>)?.['totalGapHours']
        ?? 0
      ),
    },
    conflicts: (raw['conflicts'] || []) as string[],
  }
}

/* ── Courses ── */

export async function fetchCourses(params?: {
  school?: string
  level?: number
  search?: string
}): Promise<Course[]> {
  const qs = new URLSearchParams()
  if (params?.school) qs.set('school', params.school)
  if (params?.level) qs.set('level', String(params.level))
  if (params?.search) qs.set('search', params.search)
  const q = qs.toString()
  const data = await request<Record<string, unknown>[]>(`/courses/${q ? `?${q}` : ''}`)
  return data.map(normalizeCourse)
}

export async function fetchCourse(code: string): Promise<Course> {
  const data = await request<Record<string, unknown>>(`/courses/${encodeURIComponent(code)}`)
  return normalizeCourse(data)
}

/** Get school → sorted department list mapping for major/minor dropdowns */
export async function fetchDepartments(): Promise<Record<string, string[]>> {
  const data = await request<Record<string, string[]>>('/courses/departments')
  return data
}

/** Catalog course entry (from all_courses.json) */
export interface CatalogCourse {
  code: string
  title: string
  credits: number
  department: string
}

/** Get ALL courses ever offered (union of all historical years).
 *  Used by the profile page for the completed-courses browser. */
export async function fetchAllCourses(): Promise<CatalogCourse[]> {
  const data = await request<Record<string, unknown>[]>('/courses/catalog')
  return data.map((raw) => ({
    code: (raw['code'] || '') as string,
    title: (raw['title'] || '') as string,
    credits: (raw['credits'] || 3) as number,
    department: (raw['department'] || '') as string,
  }))
}

/* ── Schedule ── */

export async function generateSchedules(
  courseCodes: string[],
  term: string,
  constraints: Record<string, unknown>,
): Promise<ScheduleResult[]> {
  const data = await request<Record<string, unknown>[]>('/schedule/generate', {
    method: 'POST',
    body: JSON.stringify({
      course_codes: courseCodes,
      term,
      constraints,
    }),
  })
  return data.map(normalizeScheduleResult)
}

/* ── Professor Ratings ── */

function normalizeProfessorRating(raw: Record<string, unknown>): ProfessorRating {
  return {
    name: (raw['name'] || '') as string,
    school: (raw['school'] || '') as string,
    overallGrade: (raw['overall_grade'] || '') as string,
    overallGpa: (raw['overall_gpa'] || 0) as number,
    teachingGrade: (raw['teaching_grade'] || '') as string,
    teachingGpa: (raw['teaching_gpa'] || 0) as number,
    gradingGrade: (raw['grading_grade'] || '') as string,
    gradingGpa: (raw['grading_gpa'] || 0) as number,
    reviewCount: (raw['review_count'] || raw['reviewCount'] || 0) as number,
    source: (raw['source'] || '') as string,
    latestTerm: (raw['latest_term'] || '') as string,
  }
}

export async function fetchProfessorRatings(
  names: string[],
): Promise<Record<string, ProfessorRating>> {
  if (names.length === 0) return {}
  // Use "|" as delimiter — instructor names contain commas ("LAST, First")
  const qs = new URLSearchParams()
  qs.set('names', names.join('|'))
  const data = await request<{ ratings: Record<string, Record<string, unknown>> }>(
    `/ratings/?${qs.toString()}`,
  )
  const result: Record<string, ProfessorRating> = {}
  for (const [name, raw] of Object.entries(data.ratings || {})) {
    if ((raw as Record<string, unknown>)['found'] !== false) {
      result[name] = normalizeProfessorRating(raw as Record<string, unknown>)
    }
  }
  return result
}

/** Lookup professor ratings from the backend and return as a record
 *  keyed by instructor name string. Handles TBA and empty names. */
export async function fetchRatingsForInstructors(
  instructors: string[],
): Promise<Record<string, ProfessorRating>> {
  const valid = instructors.filter(
    (n) => n && n.trim().toUpperCase() !== 'TBA',
  )
  if (valid.length === 0) return {}
  return fetchProfessorRatings(valid)
}

// ── Progress / Prerequisite checking ──────────────────────────

import type { CourseCheckResult } from '@/types'

function normalizeCourseCheckResult(raw: Record<string, unknown>): CourseCheckResult {
  return {
    courseCode: String(raw['course_code'] || ''),
    prereqSatisfied: Boolean(raw['prereq_satisfied']),
    prereqMissing: (raw['prereq_missing'] as string[]) || [],
    prereqRaw: String(raw['prereq_raw'] || ''),
    coreqSatisfied: Boolean(raw['coreq_satisfied']),
    coreqMissing: (raw['coreq_missing'] as string[]) || [],
    coreqRaw: String(raw['coreq_raw'] || ''),
    exclusionConflict: Boolean(raw['exclusion_conflict']),
    conflictingCourse: (raw['conflicting_course'] as string) || null,
    exclusionRaw: String(raw['exclusion_raw'] || ''),
    confidence: (raw['confidence'] as CourseCheckResult['confidence']) || 'exact',
    needsWaiver: (raw['needs_waiver'] as string[]) || [],
  }
}

export async function checkCourses(
  courseCodes: string[],
  completed: string[],
  selected: string[] = [],
): Promise<CourseCheckResult[]> {
  if (courseCodes.length === 0) return []
  const data = await request<unknown[]>('/progress/check-courses', {
    method: 'POST',
    body: JSON.stringify({
      course_codes: courseCodes,
      completed,
      selected,
    }),
  })
  return (data || []).map((raw) =>
    normalizeCourseCheckResult(raw as Record<string, unknown>),
  )
}

// ── Graduation progress ──────────────────────────────────────────

import type { GraduationProgress } from '@/types'

export interface ProgressProgram {
  code: string
  name: string
  school: string
  years: string[]
  tracks: string[]
  trackRequired: boolean
  schools: string[]
  schoolRequirementsExempt: boolean
}

/** Programs with available requirement templates. */
export async function fetchProgressPrograms(): Promise<ProgressProgram[]> {
  return request<ProgressProgram[]>('/progress/programs')
}

/** Full graduation progress report from the backend engine. */
export async function calculateProgress(
  programCode: string,
  admitYear: string,
  completed: string[],
  selected: string[] = [],
  track: string | null = null,
): Promise<GraduationProgress> {
  return request<GraduationProgress>('/progress/calculate', {
    method: 'POST',
    body: JSON.stringify({
      program_code: programCode,
      admit_year: admitYear,
      completed,
      selected,
      track,
    }),
  })
}
