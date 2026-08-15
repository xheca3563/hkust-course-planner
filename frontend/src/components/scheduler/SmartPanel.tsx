import { useAppStore } from '@/stores/appStore'
import { useT } from '@/i18n'
import { ConstraintPanel } from '@/components/constraints/ConstraintPanel'
import { ScheduleCard } from '@/components/scheduler/ScheduleCard'
import { ScheduleDetail } from '@/components/scheduler/ScheduleDetail'
import { ComparisonView } from '@/components/scheduler/ComparisonView'
import { FavoritesView } from '@/components/scheduler/FavoritesView'
import { Sparkles, Loader2, Star } from 'lucide-react'
import type { ScheduleResult } from '@/types'
import { generateSchedules } from '@/lib/api'

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function SmartPanel() {
  const t = useT()
  const selectedCourses = useAppStore((s) => s.selectedCourses)
  const constraints = useAppStore((s) => s.constraints)
  const scheduleResults = useAppStore((s) => s.scheduleResults)
  const setScheduleResults = useAppStore((s) => s.setScheduleResults)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const setIsGenerating = useAppStore((s) => s.setIsGenerating)
  const currentScheduleIdx = useAppStore((s) => s.currentScheduleIdx)
  const setCurrentScheduleIdx = useAppStore((s) => s.setCurrentScheduleIdx)
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavorite = useAppStore((s) => s.toggleFavorite)
  const showComparison = useAppStore((s) => s.showComparison)
  const setShowComparison = useAppStore((s) => s.setShowComparison)
  const professorRatings = useAppStore((s) => s.professorRatings)

  const handleGenerate = async () => {
    if (selectedCourses.length === 0) return

    setIsGenerating(true)
    try {
      const data = await generateSchedules(
        selectedCourses.map((c) => c.code),
        'Fall',
        {
          avoid_noon_back_to_back: constraints.avoidNoonBackToBack,
          noon_start: constraints.noonStart,
          noon_end: constraints.noonEnd,
          no_evening_classes: constraints.noEveningClasses,
          evening_cutoff: constraints.eveningCutoff,
          day_off: constraints.dayOff,
          avoided_instructors: constraints.avoidedInstructors,
          min_professor_rating: constraints.minProfessorRating,
          preferred_start_time: constraints.preferredStartTime,
          preferred_end_time: constraints.preferredEndTime,
          max_consecutive_hours: constraints.maxConsecutiveHours,
        },
      )
      setScheduleResults(data)
    } catch (e) {
      console.warn('[SmartPanel] API call failed, using mock fallback:', e)
      generateMockResults()
    } finally {
      setIsGenerating(false)
    }
  }

  const generateMockResults = () => {
    // Build mock schedules using actual sections from selected courses
    const mockResults: ScheduleResult[] = []
    const courses = selectedCourses
    const fmt = (m: number) => `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`

    // Helper: check if a section passes instructor-based constraints
    const sectionPassesConstraints = (sec: (typeof courses)[0]['sections'][0]): boolean => {
      const inst = sec.instructor?.trim()
      // Check avoided instructors
      const avoided = (constraints.avoidedInstructors || []).map((a: string) => a.trim().toLowerCase())
      if (inst && avoided.includes(inst.toLowerCase())) return false
      // Check min professor rating
      if (constraints.minProfessorRating > 0 && inst && inst.toUpperCase() !== 'TBA') {
        const rating = professorRatings[inst]
        // Only filter if we have actual rating data
        if (rating && rating.overallGpa > 0 && rating.overallGpa < constraints.minProfessorRating) {
          return false
        }
      }
      return true
    }

    // First: always generate the "pick first lecture + first tutorial/lab" schedule
    // This is the most common case and should always be valid
    const primarySections: typeof courses[0]['sections'] = []
    for (const course of courses) {
      const secs = course.sections || []
      const lec = secs.find(s => s.sectionType === 'L' && sectionPassesConstraints(s))
           || secs.find(s => s.sectionType === 'L')  // fallback: any lecture
      const tut = secs.find(s => s.sectionType === 'T' && sectionPassesConstraints(s))
           || secs.find(s => s.sectionType === 'T')
      const lab = secs.find(s => s.sectionType === 'LA' && sectionPassesConstraints(s))
           || secs.find(s => s.sectionType === 'LA')
      if (lec) primarySections.push(lec)
      if (tut) primarySections.push(tut)
      if (lab) primarySections.push(lab)
    }

    // Helper: check overlap and compute stats
    const buildSchedule = (sections: typeof primarySections, id: string): ScheduleResult | null => {
      const allSlots = sections.flatMap(s => s.timeSlots)
      if (allSlots.length === 0) return null

      // Check no overlap
      for (let i = 0; i < allSlots.length; i++) {
        for (let j = i + 1; j < allSlots.length; j++) {
          const a = allSlots[i], b = allSlots[j]
          if (a.day === b.day && a.startTime < b.endTime && b.startTime < a.endTime) {
            return null
          }
        }
      }

      const days = new Set(allSlots.map(s => s.day))
      const times = allSlots.map(s => timeToMin(s.startTime))
      const ends = allSlots.map(s => timeToMin(s.endTime))
      const totalMin = allSlots.reduce((s, ts) => s + timeToMin(ts.endTime) - timeToMin(ts.startTime), 0)

      let gapTotal = 0
      for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const) {
        const daySlots = allSlots.filter(s => s.day === day).sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime))
        for (let i = 1; i < daySlots.length; i++) {
          gapTotal += timeToMin(daySlots[i].startTime) - timeToMin(daySlots[i - 1].endTime)
        }
      }

      return {
        id,
        sections,
        stats: {
          daysWithClasses: days.size,
          earliestStart: fmt(Math.min(...times)),
          latestEnd: fmt(Math.max(...ends)),
          totalHours: Math.round(totalMin / 6) / 10,
          totalGapHours: Math.round(gapTotal / 6) / 10,
        },
        conflicts: [],
      }
    }

    // Always try primary (first picks) first
    const primary = buildSchedule(primarySections, 's1')
    if (primary) mockResults.push(primary)

    // Also try different tutorial selections while keeping first lecture
    let idCounter = mockResults.length + 1
    for (const course of courses) {
      const secs = course.sections || []
      const lec = secs.find(s => s.sectionType === 'L')
      const tutorials = secs.filter(s => s.sectionType === 'T')
      if (!lec || tutorials.length <= 1) continue

      // Try each alternative tutorial with this course, keeping others as first-pick
      for (let ti = 1; ti < tutorials.length && mockResults.length < 5; ti++) {
        const altSections = primarySections.map(s => {
          // Replace this course's tutorial with the alternative
          if (s.sectionType === 'T' && s.courseCode === course.code) {
            return tutorials[ti]
          }
          return s
        })
        const alt = buildSchedule(altSections, `s${idCounter++}`)
        if (alt) mockResults.push(alt)
      }
    }

    // Fallback: just first lecture of each (no tutorials)
    if (mockResults.length === 0) {
      const lecOnly = courses.flatMap(c => (c.sections || []).filter(s => s.sectionType === 'L').slice(0, 1))
      const allSlots = lecOnly.flatMap(s => s.timeSlots)
      const days = new Set(allSlots.map(s => s.day))
      const times = allSlots.map(s => timeToMin(s.startTime))
      const ends = allSlots.map(s => timeToMin(s.endTime))
      const totalMin = allSlots.reduce((s, ts) => s + timeToMin(ts.endTime) - timeToMin(ts.startTime), 0)
      mockResults.push({
        id: 's1',
        sections: lecOnly,
        stats: {
          daysWithClasses: days.size,
          earliestStart: times.length ? fmt(Math.min(...times)) : '09:00',
          latestEnd: ends.length ? fmt(Math.max(...ends)) : '17:00',
          totalHours: Math.round(totalMin / 6) / 10,
          totalGapHours: 2,
        },
        conflicts: [],
      })
    }

    setScheduleResults(mockResults)
  }

  const current = scheduleResults[currentScheduleIdx]

  return (
    <div className="max-w-5xl mx-auto space-y-2">
      {/* Selected courses + action buttons — merged row */}
      {selectedCourses.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Sparkles size={36} className="mx-auto mb-2 opacity-50" />
          <p className="text-base font-medium text-slate-500">{t('scheduler.emptyTitle')}</p>
          <p className="text-xs mt-1">{t('scheduler.emptyHint')}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-1.5 bg-[#E8F0F8] rounded-lg">
          <span className="text-sm font-medium text-[#003366] flex-shrink-0">{t('scheduler.selectedCourses')}</span>
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            {selectedCourses.map((c) => (
              <span
                key={c.code}
                className="px-2 py-0.5 rounded-full bg-white text-sm text-slate-700 border border-slate-200"
              >
                {c.code}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
            {favorites.length >= 2 && (
              <button
                onClick={() => setShowComparison(!showComparison)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
                  showComparison
                    ? 'bg-[#C8962E] text-white border-[#C8962E]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-[#C8962E] hover:text-[#C8962E]'
                }`}
              >
                <Star size={12} className="inline mr-0.5" fill={showComparison ? 'white' : 'none'} />
                {t('scheduler.compareCount', { n: favorites.length })}
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`
                flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold
                transition-all flex-shrink-0
                ${
                  isGenerating
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#C8962E] text-white hover:bg-[#B8860E]'
                }
              `}
            >
              {isGenerating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {isGenerating ? t('scheduler.generating') : t('scheduler.generate')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Constraints panel + thumbnails */}
        <div className="lg:col-span-1 space-y-2">
          <ConstraintPanel />

          {/* All results thumbnails */}
          {scheduleResults.length > 0 && !showComparison && (
            <div>
              <p className="text-xs text-slate-500 mb-2">
                {t('scheduler.allSchedules', { n: scheduleResults.length })}
                <span className="ml-1 text-slate-400">{t('scheduler.clickToJump')}</span>
              </p>
              <div className="grid grid-cols-1 gap-1.5 max-h-80 overflow-y-auto">
                {scheduleResults.map((r, idx) => (
                  <ScheduleCard
                    key={r.id}
                    result={r}
                    isSelected={idx === currentScheduleIdx}
                    isFavorited={favorites.includes(r.id)}
                    onSelect={() => setCurrentScheduleIdx(idx)}
                    onFavorite={() => toggleFavorite(r.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          {scheduleResults.length > 0 && !showComparison && (
            <div className="space-y-2">
              {/* Navigation */}
              <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 p-1.5">
                <button
                  onClick={() => setCurrentScheduleIdx(Math.max(0, currentScheduleIdx - 1))}
                  disabled={currentScheduleIdx === 0}
                  className="px-2 py-1 text-xs rounded border border-slate-200
                             hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {t('scheduler.previous')}
                </button>
                <span className="text-xs font-semibold text-slate-700">
                  {t('scheduler.scheduleNofM', { n: currentScheduleIdx + 1, total: scheduleResults.length })}
                </span>
                <button
                  onClick={() => setCurrentScheduleIdx(Math.min(scheduleResults.length - 1, currentScheduleIdx + 1))}
                  disabled={currentScheduleIdx >= scheduleResults.length - 1}
                  className="px-2 py-1 text-xs rounded border border-slate-200
                             hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {t('scheduler.next')}
                </button>
                <button
                  onClick={() => toggleFavorite(current.id)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    favorites.includes(current.id)
                      ? 'bg-amber-50 text-amber-600 border-amber-300'
                      : 'border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-500'
                  }`}
                >
                  <Star size={14} className="inline mr-1" fill={favorites.includes(current.id) ? '#D69E2E' : 'none'} />
                  {favorites.includes(current.id) ? t('scheduler.favorited') : t('scheduler.favorite')}
                </button>
              </div>

              {/* Stats cards — compact */}
              {current && (
                <div className="grid grid-cols-4 gap-1">
                  <div className="bg-white rounded border border-slate-200 p-1 text-center">
                    <div className="text-xs font-bold text-[#003366]">{current.stats.daysWithClasses}</div>
                    <div className="text-[9px] text-slate-400">{t('scheduler.daysOnCampus')}</div>
                  </div>
                  <div className="bg-white rounded border border-slate-200 p-1 text-center">
                    <div className="text-xs font-bold text-[#003366]">{current.stats.earliestStart}</div>
                    <div className="text-[9px] text-slate-400">{t('scheduler.earliestStart')}</div>
                  </div>
                  <div className="bg-white rounded border border-slate-200 p-1 text-center">
                    <div className="text-xs font-bold text-[#003366]">{current.stats.latestEnd}</div>
                    <div className="text-[9px] text-slate-400">{t('scheduler.latestEnd')}</div>
                  </div>
                  <div className="bg-white rounded border border-slate-200 p-1 text-center">
                    <div className="text-xs font-bold text-[#003366]">{current.stats.totalGapHours}h</div>
                    <div className="text-[9px] text-slate-400">{t('scheduler.totalFreeTime')}</div>
                  </div>
                </div>
              )}

              {/* Current schedule detail */}
              {current && <ScheduleDetail result={current} />}
            </div>
          )}

          {/* Comparison view */}
          {showComparison && (
            <ComparisonView
              onClose={() => setShowComparison(false)}
            />
          )}

          {/* My Favorites */}
          {favorites.length > 0 && !showComparison && (
            <FavoritesView />
          )}
        </div>
      </div>
    </div>
  )
}
