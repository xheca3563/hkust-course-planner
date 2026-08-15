import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { X, AlertTriangle, Clock, MapPin, Users, BookOpen, Star, Loader2 } from 'lucide-react'
import type { Course, Section } from '@/types'
import { fetchCourse } from '@/lib/api'
import { PrereqWarningBadge } from '@/components/course/PrereqWarning'
import { useT } from '@/i18n'

export function CourseDetailPanel() {
  const t = useT()
  const detailCourse = useAppStore((s) => s.detailCourse)
  const closeDetail = useAppStore((s) => s.closeDetail)
  const selectedCourses = useAppStore((s) => s.selectedCourses)
  const addCourse = useAppStore((s) => s.addCourse)
  const removeCourse = useAppStore((s) => s.removeCourse)
  const manualSelections = useAppStore((s) => s.manualSelections)
  const setCourseSections = useAppStore((s) => s.setCourseSections)
  const currentTerm = useAppStore((s) => s.currentTerm)

  // Fetch full course with sections on mount
  const [fullCourse, setFullCourse] = useState<Course | null>(null)
  const [loadingSections, setLoadingSections] = useState(false)

  useEffect(() => {
    if (!detailCourse) { setFullCourse(null); return }
    // If the course already has sections loaded, use it directly
    if (detailCourse.sections && detailCourse.sections.length > 0) {
      setFullCourse(detailCourse)
      return
    }
    // Otherwise fetch full data
    let cancelled = false
    setLoadingSections(true)
    fetchCourse(detailCourse.code).then((full) => {
      if (!cancelled) { setFullCourse(full); setLoadingSections(false) }
    }).catch(() => {
      if (!cancelled) { setFullCourse(detailCourse); setLoadingSections(false) }
    })
    return () => { cancelled = true }
  }, [detailCourse])

  const course = fullCourse || detailCourse
  if (!detailCourse) return null

  const professorRatings = useAppStore((s) => s.professorRatings)
  const loadRatingsForCourses = useAppStore((s) => s.loadRatingsForCourses)

  // Load ratings when full course data arrives
  useEffect(() => {
    if (course?.sections?.length) {
      loadRatingsForCourses([course])
    }
  }, [course, loadRatingsForCourses])

  const isSelected = !!selectedCourses.find((c) => c.code === detailCourse.code)
  const selectedSectionIds = manualSelections[detailCourse.code] || []

  // Detect conflicts with other selected courses
  const otherCourses = selectedCourses.filter((c) => c.code !== detailCourse.code)
  const otherSlots = otherCourses.flatMap((c) => {
    const selIds = manualSelections[c.code] || []
    const selSections = c.sections.filter((s) => selIds.includes(s.sectionId))
    return selSections.flatMap((s) => s.timeSlots)
  })

  const slotsOverlap = (a: { day: string; startTime: string; endTime: string }, b: { day: string; startTime: string; endTime: string }) => {
    if (a.day !== b.day) return false
    const aS = a.startTime, aE = a.endTime, bS = b.startTime, bE = b.endTime
    return aS < bE && bS < aE
  }

  const sectionHasConflict = (section: Section): string[] => {
    const conflicts: string[] = []
    for (const slot of section.timeSlots) {
      for (const other of otherSlots) {
        if (slotsOverlap(slot, other)) {
          conflicts.push(t('course.conflictWithAnotherCourse', { day: slot.day, start: slot.startTime, end: slot.endTime }))
        }
      }
    }
    return conflicts
  }

  const toggleSection = (sectionId: string) => {
    const current = selectedSectionIds.includes(sectionId)
      ? selectedSectionIds.filter((id) => id !== sectionId)
      : [...selectedSectionIds, sectionId]
    setCourseSections(detailCourse.code, current)
  }

  // Group sections by type
  const byType: Record<string, Section[]> = {}
  for (const s of course?.sections || []) {
    (byType[s.sectionType] ||= []).push(s)
  }

  const typeLabels: Record<string, string> = { L: t('course.lecture'), T: t('course.tutorial'), LA: t('course.lab') }

  // Helper to get rating badge color based on letter grade
  const getRatingBadge = (instructor: string) => {
    const rating = professorRatings[instructor]
    if (!rating || !rating.overallGrade) return null
    const grade = rating.overallGrade
    let color = 'bg-slate-100 text-slate-600'
    if (grade.startsWith('A')) color = 'bg-green-100 text-green-700'
    else if (grade.startsWith('B')) color = 'bg-blue-100 text-blue-700'
    else if (grade.startsWith('C')) color = 'bg-yellow-100 text-yellow-700'
    else color = 'bg-red-100 text-red-600'
    return { grade, color }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={closeDetail}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-xl flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>{detailCourse.school}</span>
              <span>→</span>
              <span>{detailCourse.department}</span>
              <span>→</span>
              <span className="font-semibold text-slate-700">{detailCourse.code}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800">{detailCourse.title}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-slate-600">{t('course.creditsCount', { n: detailCourse.credits })}</span>
              {detailCourse.rating && (
                <span className="flex items-center gap-1 text-sm text-amber-500">
                  <Star size={14} fill="currentColor" /> {detailCourse.rating}
                </span>
              )}
            </div>
          </div>
          <button onClick={closeDetail} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Section loading indicator */}
        {loadingSections && (
          <div className="flex items-center gap-2 px-6 py-2 bg-slate-50 text-xs text-slate-500">
            <Loader2 size={12} className="animate-spin" />
            {t('course.loadingSections')}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 space-y-5">
          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
              <BookOpen size={14} /> {t('course.description')}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">{detailCourse.description}</p>
          </div>

          {/* Requirements */}
          <div className="grid grid-cols-1 gap-3">
            {detailCourse.prerequisites && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase">{t('course.prerequisites')}</h4>
                <p className="text-sm text-slate-700 mt-0.5">{detailCourse.prerequisites}</p>
                <PrereqWarningBadge courseCode={detailCourse.code} compact={false} />
              </div>
            )}
            {detailCourse.corequisites && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase">{t('course.corequisites')}</h4>
                <p className="text-sm text-slate-700 mt-0.5">{detailCourse.corequisites}</p>
              </div>
            )}
            {detailCourse.exclusions && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase">{t('course.exclusions')}</h4>
                <p className="text-sm text-slate-700 mt-0.5">{detailCourse.exclusions}</p>
              </div>
            )}
          </div>

          {/* Sections */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              {t('course.availableSections', { n: course?.sections?.length || 0, term: currentTerm.label })}
            </h3>
            {Object.entries(byType).map(([type, sections]) => (
              <div key={type} className="mb-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1.5">
                  {typeLabels[type] || type} ({sections.length})
                </h4>
                <div className="space-y-1.5">
                  {sections.map((sec) => {
                    const conflicts = sectionHasConflict(sec)
                    const isChosen = selectedSectionIds.includes(sec.sectionId)
                    return (
                      <div
                        key={sec.sectionId}
                        onClick={() => toggleSection(sec.sectionId)}
                        className={`
                          flex items-center gap-3 p-2.5 rounded-lg border text-sm cursor-pointer transition-all
                          ${isChosen
                            ? 'border-[#003366] bg-[#E8F0F8]'
                            : 'border-slate-100 hover:border-slate-300 bg-white'
                          }
                          ${conflicts.length > 0 ? 'border-red-300 bg-red-50' : ''}
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={isChosen}
                          onChange={() => toggleSection(sec.sectionId)}
                          className="w-4 h-4 rounded border-slate-300 text-[#003366] focus:ring-[#003366]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">{sec.sectionId}</span>
                            <span className="text-xs text-slate-500">{sec.instructor}</span>
                            {sec.instructor && getRatingBadge(sec.instructor) && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getRatingBadge(sec.instructor)!.color}`}>
                                {getRatingBadge(sec.instructor)!.grade}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                            {sec.timeSlots.map((ts, i) => (
                              <span key={i} className="flex items-center gap-1">
                                <Clock size={10} /> {ts.day} {ts.startTime}-{ts.endTime}
                              </span>
                            ))}
                            {sec.timeSlots.some(ts => ts.venue) && (
                              <span className="flex items-center gap-1">
                                <MapPin size={10} /> {sec.timeSlots.map(ts => ts.venue).filter(Boolean).join(', ') || 'TBA'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400 flex items-center gap-0.5">
                              <Users size={10} /> {sec.enrol}/{sec.quota}
                            </span>
                            {sec.remarks && (
                              <span className="text-xs text-amber-600">{sec.remarks}</span>
                            )}
                          </div>
                        </div>
                        {conflicts.length > 0 && (
                          <div className="flex-shrink-0 text-red-500" title={conflicts.join('\n')}>
                            <AlertTriangle size={16} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 rounded-b-xl flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {isSelected ? t('course.addedToTimetable') : t('course.clickSectionToSelect')}
          </div>
          <button
            onClick={() => isSelected ? removeCourse(detailCourse.code) : addCourse(detailCourse)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              isSelected
                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                : 'bg-[#003366] text-white hover:bg-[#002244]'
            }`}
          >
            {isSelected ? t('course.removeCourse') : t('course.addCourse')}
          </button>
        </div>
      </div>
    </div>
  )
}
