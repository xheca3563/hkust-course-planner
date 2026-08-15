/** Supabase database helpers for cloud persistence. */

import { supabase } from '@/lib/supabase'
import type { Course, ScheduleResult, UserConstraint } from '@/types'

/* ── Timetables ── */

export interface SavedTimetable {
  id: string
  user_id: string
  name: string
  courses: Course[]
  selections: Record<string, string[]>
  created_at: string
  updated_at: string
}

export async function saveTimetable(
  userId: string,
  name: string,
  courses: Course[],
  selections: Record<string, string[]>,
  existingId?: string,
): Promise<string | null> {
  const row: Record<string, unknown> = {
    user_id: userId,
    name,
    courses,
    selections,
    updated_at: new Date().toISOString(),
  }
  if (existingId) row.id = existingId

  const { data, error } = await supabase
    .from('saved_timetables')
    .upsert(row)
    .select('id')
    .single()

  if (error) {
    console.warn('[db] saveTimetable error:', error.message)
    return null
  }
  return data?.id ?? null
}

export async function loadTimetables(
  userId: string,
): Promise<SavedTimetable[]> {
  const { data, error } = await supabase
    .from('saved_timetables')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.warn('[db] loadTimetables error:', error.message)
    return []
  }
  return (data || []) as SavedTimetable[]
}

export async function deleteTimetable(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('saved_timetables')
    .delete()
    .eq('id', id)

  return !error
}

/* ── Favorites ── */

export interface SavedFavorite {
  id: string
  user_id: string
  schedule_data: ScheduleResult
  created_at: string
}

export async function saveFavorites(
  userId: string,
  schedules: ScheduleResult[],
): Promise<boolean> {
  // Delete existing favorites for this user first
  await supabase.from('saved_favorites').delete().eq('user_id', userId)

  if (schedules.length === 0) return true

  const rows = schedules.map((s) => ({
    user_id: userId,
    schedule_data: s,
  }))

  const { error } = await supabase.from('saved_favorites').insert(rows)
  if (error) {
    console.warn('[db] saveFavorites error:', error.message)
    return false
  }
  return true
}

export async function loadFavorites(
  userId: string,
): Promise<ScheduleResult[]> {
  const { data, error } = await supabase
    .from('saved_favorites')
    .select('schedule_data')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('[db] loadFavorites error:', error.message)
    return []
  }
  return (data || []).map((r: Record<string, unknown>) => r['schedule_data'] as ScheduleResult)
}

/* ── Preferences ── */

export async function savePreferences(
  userId: string,
  constraints: UserConstraint,
): Promise<boolean> {
  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      constraints,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    console.warn('[db] savePreferences error:', error.message)
    return false
  }
  return true
}

export async function loadPreferences(
  userId: string,
): Promise<UserConstraint | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('constraints')
    .eq('user_id', userId)
    .single()

  if (error) {
    return null
  }
  return (data?.constraints || null) as UserConstraint | null
}

// ── Profile ──────────────────────────────────────────────────

export async function saveProfile(
  userId: string,
  profile: {
    major: string | null
    extendedMajor: string | null
    minor: string | null
    school: string | null
    admissionYear: string | null
    completedCourses: string[]
    creditsAdjustment: number
    track: string | null
  },
): Promise<boolean> {
  if (!supabase) return false
  const fields = {
    major: profile.major,
    extended_major: profile.extendedMajor,
    minor: profile.minor,
    school: profile.school,
    admission_year: profile.admissionYear,
    completed_courses: profile.completedCourses,
    credits_adjustment: profile.creditsAdjustment,
    track: profile.track,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', userId)
    .select('id')

  if (error) {
    console.warn('[db] saveProfile error:', error.message)
    return false
  }

  // No row yet (e.g. created before the profile trigger existed) — insert.
  if (!data || data.length === 0) {
    const { error: insErr } = await supabase
      .from('profiles')
      .insert({ id: userId, ...fields })
    if (insErr) {
      console.warn('[db] saveProfile insert error:', insErr.message)
      return false
    }
  }
  return true
}

export async function loadProfile(
  userId: string,
): Promise<{
  major: string | null
  extendedMajor: string | null
  minor: string | null
  school: string | null
  admissionYear: string | null
  completedCourses: string[]
  creditsAdjustment: number
  track: string | null
} | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('major, extended_major, minor, school, admission_year, completed_courses, credits_adjustment, track')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    major: (data.major as string) || null,
    extendedMajor: (data.extended_major as string) || null,
    minor: (data.minor as string) || null,
    school: (data.school as string) || null,
    admissionYear: (data.admission_year as string) || null,
    completedCourses: (data.completed_courses as string[]) || [],
    creditsAdjustment: (data.credits_adjustment as number) || 0,
    track: (data.track as string) || null,
  }
}
