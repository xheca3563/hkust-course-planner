import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useAuth } from '@/contexts/AuthContext'
import { X, Search, Trash2, ArrowLeft, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { fetchAllCourses, fetchProgressPrograms, type CatalogCourse, type ProgressProgram } from '@/lib/api'
import { getMajorsForSchool, getMinors, getExtendedMajors, getAvailableYears } from '@/data/programs'
import { useT, type TKey } from '@/i18n'

interface ProfilePageProps {
  onClose: () => void
}

const SCHOOLS: { value: string; labelKey: TKey }[] = [
  { value: 'SSCI', labelKey: 'profile.schoolSSCI' },
  { value: 'SENG', labelKey: 'profile.schoolSENG' },
  { value: 'SBM', labelKey: 'profile.schoolSBM' },
  { value: 'SHSS', labelKey: 'profile.schoolSHSS' },
  { value: 'AIS', labelKey: 'profile.schoolAIS' },
]

function buildDeptHierarchy(courses: CatalogCourse[]) {
  const depts: Record<string, CatalogCourse[]> = {}
  for (const c of courses) {
    const dept = c.department || 'Other'
    if (!depts[dept]) depts[dept] = []
    depts[dept].push(c)
  }
  return depts
}

export function ProfilePage({ onClose }: ProfilePageProps) {
  const t = useT()
  const profile = useAppStore((s) => s.profile)
  const updateProfile = useAppStore((s) => s.updateProfile)
  const addCompletedCourse = useAppStore((s) => s.addCompletedCourse)
  const removeCompletedCourse = useAppStore((s) => s.removeCompletedCourse)
  const refreshPrereqStatus = useAppStore((s) => s.refreshPrereqStatus)
  const syncToCloud = useAppStore((s) => s.syncToCloud)
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // All courses for the department browser (from catalog — all years union)
  const [allCourses, setAllCourses] = useState<CatalogCourse[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)

  // Progress templates (tracks / school requirements) from the backend
  const [progressPrograms, setProgressPrograms] = useState<ProgressProgram[]>([])

  // Department browser state: null = department grid, string = active department
  const [activeDept, setActiveDept] = useState<string | null>(null)
  const [courseSearch, setCourseSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setCoursesLoading(true)
      try {
        const courses = await fetchAllCourses()
        if (!cancelled) setAllCourses(courses)
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setCoursesLoading(false)
      }
      try {
        const programs = await fetchProgressPrograms()
        if (!cancelled) setProgressPrograms(programs)
      } catch {
        // Silently fail — track selector just stays empty
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const hierarchy = useMemo(() => buildDeptHierarchy(allCourses), [allCourses])

  // Available years from scraped program catalog (descending: latest first)
  const availableYears = getAvailableYears().reverse()

  // Use admission year for program data; default to latest available year
  const effectiveYear = profile.admissionYear || availableYears[0]

  // Majors: based on admission year + selected school
  const schoolMajors = useMemo(
    () => getMajorsForSchool(profile.school, effectiveYear),
    [profile.school, effectiveYear]
  )

  // Progress template of the selected major (tracks / school info)
  const majorProgram = useMemo(
    () => progressPrograms.find((p) => p.code === profile.major),
    [progressPrograms, profile.major]
  )

  // Extended majors: based on admission year only (available to all schools)
  const yearExtendedMajors = useMemo(
    () => getExtendedMajors(effectiveYear),
    [effectiveYear]
  )

  // Minors: based on admission year
  const yearMinors = useMemo(
    () => getMinors(effectiveYear),
    [effectiveYear]
  )

  // Flattened course list filtered by search within active department
  const deptCourses = useMemo(() => {
    if (!activeDept) return []
    const courses = hierarchy[activeDept] || []
    if (!courseSearch.trim()) return courses
    const q = courseSearch.toLowerCase()
    return courses.filter((c) =>
      c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
    )
  }, [activeDept, hierarchy, courseSearch])

  const deptList = Object.entries(hierarchy).sort(([a], [b]) => a.localeCompare(b))

  const completedCredits = profile.completedCourses.length * 3

  const handleAddCourse = (code: string) => {
    if (!profile.completedCourses.includes(code)) {
      addCompletedCourse(code)
      setTimeout(() => refreshPrereqStatus(), 100)
    }
  }

  const handleRemoveCourse = (code: string) => {
    removeCompletedCourse(code)
    setTimeout(() => refreshPrereqStatus(), 100)
  }

  const handleToggleCourse = (code: string) => {
    if (profile.completedCourses.includes(code)) {
      handleRemoveCourse(code)
    } else {
      handleAddCourse(code)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-8">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">{t('profile.title')}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* 1. Admission Year — FIRST question, determines available programs below */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('profile.admissionYear')}
            </label>
            <select
              value={profile.admissionYear || ''}
              onChange={(e) => {
                const newYear = e.target.value || null
                // Clear major/extended/minor when year changes (programs vary by year)
                updateProfile({
                  admissionYear: newYear,
                  major: null,
                  extendedMajor: null,
                  minor: null,
                  track: null,
                })
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t('profile.notSelected')}</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              {t('profile.admissionYearHint')}
            </p>
          </div>

          {/* 2. School */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('profile.school')}
            </label>
            <select
              value={profile.school || ''}
              onChange={(e) => {
                const newSchool = e.target.value || null
                // Keep the major when the new school also offers it
                // (joint-school programs like DSCT: SSCI + SENG)
                const newMajors = getMajorsForSchool(newSchool, effectiveYear)
                const keepMajor = profile.major
                  && newMajors.some((m) => m.code === profile.major)
                  ? profile.major
                  : null
                updateProfile({
                  school: newSchool,
                  major: keepMajor,
                  track: keepMajor ? profile.track : null,
                })
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t('profile.notSelected')}</option>
              {SCHOOLS.map((s) => (
                <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
              ))}
            </select>
          </div>

          {/* 3. Major — required; based on admission year + school */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('profile.major')}
            </label>
            {!profile.school ? (
              <p className="text-xs text-slate-400 italic py-2">{t('profile.selectSchoolFirst')}</p>
            ) : schoolMajors.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                {t('profile.noMajorsForYear', { year: effectiveYear })}
              </p>
            ) : (
              <select
                value={profile.major || ''}
                onChange={(e) => updateProfile({ major: e.target.value || null, track: null })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t('profile.notSelected')}</option>
                {schoolMajors.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.code} — {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 3b. Track — for programs split into tracks/options (MATH, PHYS…) */}
          {profile.major && majorProgram && majorProgram.tracks.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('profile.track')}
                {majorProgram.trackRequired && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
                    {t('profile.required')}
                  </span>
                )}
              </label>
              <select
                value={profile.track || ''}
                onChange={(e) => updateProfile({ track: e.target.value || null })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">
                  {majorProgram.trackRequired ? t('profile.selectTrack') : t('profile.regularCurriculum')}
                </option>
                {majorProgram.tracks.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                {majorProgram.trackRequired
                  ? t('profile.trackRequiredHint')
                  : t('profile.trackOptionalHint')}
              </p>
            </div>
          )}

          {/* 4. Extended Major — optional; based on admission year (cross-school) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('profile.extendedMajor')}
            </label>
            {yearExtendedMajors.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                {t('profile.noExtendedMajors', { year: effectiveYear })}
              </p>
            ) : (
              <select
                value={profile.extendedMajor || ''}
                onChange={(e) => updateProfile({ extendedMajor: e.target.value || null })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t('profile.noExtendedMajor')}</option>
                {yearExtendedMajors.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.code} — {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 5. Minor — optional; based on admission year */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('profile.minor')}
            </label>
            <select
              value={profile.minor || ''}
              onChange={(e) => updateProfile({ minor: e.target.value || null })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t('profile.noMinor')}</option>
              {yearMinors.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code} — {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Credits adjustment */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('profile.extraCredits')}
            </label>
            <input
              type="number"
              min={0}
              value={profile.creditsAdjustment || 0}
              onChange={(e) => updateProfile({ creditsAdjustment: parseInt(e.target.value) || 0 })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Completed Courses */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">
                {t('profile.completedCourses')}
              </label>
              <span className="text-xs text-slate-400">
                {t('profile.courseCount', { count: profile.completedCourses.length, credits: completedCredits })}
              </span>
            </div>

            {/* Selected chips */}
            {profile.completedCourses.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3 p-2 bg-slate-50 rounded-md max-h-32 overflow-y-auto">
                {profile.completedCourses.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700"
                  >
                    {code}
                    <button
                      onClick={() => handleRemoveCourse(code)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Department browser */}
            {coursesLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 size={24} className="animate-spin mr-2" />
                <span className="text-sm">{t('profile.loadingCourses')}</span>
              </div>
            ) : activeDept !== null ? (
              /* Department detail view */
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50">
                  <button
                    onClick={() => { setActiveDept(null); setCourseSearch('') }}
                    className="flex items-center gap-1 text-xs font-medium text-[#003366] hover:text-[#002244]"
                  >
                    <ArrowLeft size={14} />
                    {activeDept}
                  </button>
                  <span className="text-[10px] text-slate-400">{t('profile.deptCoursesCount', { count: deptCourses.length })}</span>
                  <div className="flex-1" />
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      placeholder={t('profile.search')}
                      className="w-32 pl-6 pr-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#003366]/20"
                    />
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {deptCourses.map((c) => {
                    const isAdded = profile.completedCourses.includes(c.code)
                    return (
                      <button
                        key={c.code}
                        onClick={() => handleToggleCourse(c.code)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2 text-left text-sm
                          border-b border-slate-50 hover:bg-slate-50 transition-colors
                          ${isAdded ? 'bg-blue-50/50' : ''}
                        `}
                      >
                        <div
                          className={`
                            w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                            transition-colors
                            ${isAdded
                              ? 'bg-[#003366] border-[#003366]'
                              : 'border-slate-300'
                            }
                          `}
                        >
                          {isAdded && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span className={`font-medium w-24 flex-shrink-0 ${isAdded ? 'text-[#003366]' : 'text-slate-700'}`}>
                          {c.code}
                        </span>
                        <span className="text-xs text-slate-500 truncate flex-1 min-w-0">{c.title}</span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">{t('profile.creditsUnit', { credits: c.credits })}</span>
                      </button>
                    )
                  })}
                  {deptCourses.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-6">{t('profile.noMatches')}</p>
                  )}
                </div>
              </div>
            ) : (
              /* Department grid */
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                  <span className="text-xs text-slate-500">{t('profile.browseByDept')}</span>
                </div>
                <div className="grid grid-cols-3 max-h-56 overflow-y-auto">
                  {deptList.map(([dept, courses]) => (
                    <button
                      key={dept}
                      onClick={() => setActiveDept(dept)}
                      className="flex items-center gap-1.5 px-3 py-2.5 hover:bg-slate-50 transition-colors border-b border-r border-slate-50 text-left"
                    >
                      <span className="text-xs font-semibold text-slate-600 truncate">{dept}</span>
                      <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">{courses.length}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 flex-shrink-0">
          {saveMsg && (
            <span className={`flex items-center gap-1 text-xs ${saveMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
              {saveMsg.ok
                ? <CheckCircle2 size={13} />
                : <AlertTriangle size={13} />}
              {saveMsg.text}
            </span>
          )}
          <button
            onClick={async () => {
              setSaving(true)
              setSaveMsg(null)
              if (!user) {
                setSaveMsg({ ok: false, text: t('profile.saveNotLoggedIn') })
                setSaving(false)
                return
              }
              const ok = await syncToCloud()
              setSaveMsg(ok
                ? { ok: true, text: t('profile.savedToAccount') }
                : { ok: false, text: t('profile.saveFailed') })
              setSaving(false)
            }}
            disabled={saving}
            className="px-4 py-2 bg-[#003366] text-white rounded-md text-sm font-medium hover:bg-[#002244] disabled:opacity-60 flex items-center gap-1.5"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {t('profile.save')}
          </button>
        </div>
      </div>
    </div>
  )
}