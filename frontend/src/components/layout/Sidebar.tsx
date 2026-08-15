import { useState, useMemo, useEffect } from 'react'
import { Search, X, ArrowLeft, Loader2 } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { CourseCard } from '@/components/course/CourseCard'
import { fetchCourses, fetchCourse } from '@/lib/api'
import { useT } from '@/i18n'
import type { Course } from '@/types'

/* ── Build department → course hierarchy ── */
function buildDeptHierarchy(courses: Course[]) {
  const depts: Record<string, Course[]> = {}
  for (const c of courses) {
    const dept = c.department || 'Other'
    if (!depts[dept]) depts[dept] = []
    depts[dept].push(c)
  }
  return depts
}


export function Sidebar() {
  const t = useT()
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const selectedCourses = useAppStore((s) => s.selectedCourses)
  const addCourse = useAppStore((s) => s.addCourse)
  const removeCourse = useAppStore((s) => s.removeCourse)

  // Load brief course list from backend
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setLoadError(false)
      try {
        const courses = await fetchCourses()
        if (!cancelled) setAllCourses(courses)
      } catch {
        if (!cancelled) {
          // Fallback: try loading mock data
          try {
            const { ALL_COURSES } = await import('@/lib/mockData')
            if (!cancelled) setAllCourses(ALL_COURSES)
          } catch {
            if (!cancelled) setLoadError(true)
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const hierarchy = useMemo(() => buildDeptHierarchy(allCourses), [allCourses])

  // Navigation state: null = department list, string = viewing that department
  const [activeDept, setActiveDept] = useState<string | null>(null)

  // If searching, do flat search instead of hierarchy
  const isSearching = searchQuery.trim().length > 0

  const flatResults = useMemo(() => {
    if (!isSearching) return []
    const q = searchQuery.toLowerCase()
    return allCourses.filter((c) =>
      c.code.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.department.toLowerCase().includes(q)
    )
  }, [isSearching, searchQuery, allCourses])

  const deptList = Object.entries(hierarchy).sort(([a], [b]) => a.localeCompare(b))

  // ── Add course with full details ──
  const handleAddCourse = async (course: Course) => {
    // Try to fetch full course details (with sections) from API
    try {
      const full = await fetchCourse(course.code)
      addCourse(full)
    } catch {
      // Fallback: use the brief course data (may have no sections)
      addCourse(course)
    }
  }

  // ── Render content based on state ──
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Loader2 size={32} className="animate-spin mb-3" />
          <p className="text-sm">{t('layout.loadingCourses')}</p>
        </div>
      )
    }

    if (loadError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <p className="text-sm text-red-500">{t('layout.loadCoursesFailed')}</p>
          <p className="text-xs mt-1">{t('layout.checkBackend')}</p>
        </div>
      )
    }

    if (isSearching) {
      return (
        <div className="p-2">
          <p className="text-xs text-slate-500 px-2 py-1.5">
            {t('layout.courseCount', { n: flatResults.length })}
            {allCourses.length > 0 && t('layout.totalCourseCount', { n: allCourses.length })}
          </p>
          <div className="space-y-1.5">
            {flatResults.map((c) => (
              <CourseCard
                key={c.code}
                course={c}
                isSelected={!!selectedCourses.find((s) => s.code === c.code)}
                onAdd={() => handleAddCourse(c)}
                onRemove={() => removeCourse(c.code)}
              />
            ))}
          </div>
        </div>
      )
    }

    // Department detail view
    if (activeDept !== null) {
      const courses = hierarchy[activeDept] || []
      return (
        <div>
          {/* Back button + department name */}
          <button
            onClick={() => { setActiveDept(null); setSearchQuery('') }}
            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-200 sticky top-0 bg-white z-10"
          >
            <ArrowLeft size={14} className="text-[#003366]" />
            <span className="text-xs font-semibold text-[#003366]">{activeDept}</span>
            <span className="text-[10px] text-slate-400 ml-auto">{t('layout.courseCount', { n: courses.length })}</span>
          </button>

          {/* Course list */}
          <div className="p-1.5 space-y-1">
            {courses.map((c) => (
              <CourseCard
                key={c.code}
                course={c}
                isSelected={!!selectedCourses.find((s) => s.code === c.code)}
                onAdd={() => handleAddCourse(c)}
                onRemove={() => removeCourse(c.code)}
              />
            ))}
          </div>
        </div>
      )
    }

    // Department list (home)
    return (
      <div className="grid grid-cols-2">
        {deptList.map(([dept, courses]) => (
          <button
            key={dept}
            onClick={() => setActiveDept(dept)}
            className="flex items-center gap-1.5 px-3 py-2 hover:bg-slate-50 transition-colors border-b border-r border-slate-50 text-left"
          >
            <span className="text-xs font-semibold text-slate-600 truncate">{dept}</span>
            <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">{courses.length}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b border-slate-200">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('layout.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setActiveDept(null) }}
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]
                       placeholder:text-slate-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Selected courses */}
      {selectedCourses.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-100 bg-[#E8F0F8]/50">
          <p className="text-xs font-semibold text-[#003366] mb-1.5">{t('layout.selectedCourses', { n: selectedCourses.length })}</p>
          <div className="flex flex-wrap gap-1">
            {selectedCourses.map((c) => (
              <span key={c.code} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#003366] text-white text-xs">
                {c.code}
                <button onClick={() => removeCourse(c.code)} className="hover:text-red-300"><X size={12} /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Course browser */}
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  )
}
