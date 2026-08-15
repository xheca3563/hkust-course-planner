import { useAppStore } from '@/stores/appStore'
import type { DayOfWeek, Section } from '@/types'
import { Plus, X } from 'lucide-react'
import { useT, type TKey } from '@/i18n'

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DAY_LABELS: Record<DayOfWeek, TKey> = {
  Mon: 'timetable.dayMon',
  Tue: 'timetable.dayTue',
  Wed: 'timetable.dayWed',
  Thu: 'timetable.dayThu',
  Fri: 'timetable.dayFri',
  Sat: 'timetable.daySat',
  Sun: 'timetable.daySun',
}

const HALF_HOURS: string[] = []
for (let h = 8; h < 20; h++) {
  HALF_HOURS.push(`${String(h).padStart(2, '0')}:00`)
  HALF_HOURS.push(`${String(h).padStart(2, '0')}:30`)
}
HALF_HOURS.push('20:00')
HALF_HOURS.push('20:30')

// Visual constants
const TIME_COL_WIDTH = 48
const SLOT_HEIGHT = 17 // px per half-hour
const TOTAL_SLOTS = HALF_HOURS.length
const GRID_HEIGHT = TOTAL_SLOTS * SLOT_HEIGHT

const COURSE_COLORS = [
  '#003366', '#C8962E', '#2E7D32', '#C62828', '#6A1B9A',
  '#00838F', '#D84315', '#4527A0',
]

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

interface CourseEntry {
  courseCode: string
  title: string
  sectionId: string
  instructor: string
  color: string
  day: string
  startMin: number
  endMin: number
  venue: string
}

export function TimetableView() {
  const t = useT()
  const selectedCourses = useAppStore((s) => s.selectedCourses)
  const manualSelections = useAppStore((s) => s.manualSelections)
  const openDetail = useAppStore((s) => s.openDetail)
  const timetableTabs = useAppStore((s) => s.timetableTabs)
  const activeTimetableId = useAppStore((s) => s.activeTimetableId)
  const switchTimetable = useAppStore((s) => s.switchTimetable)
  const addTimetable = useAppStore((s) => s.addTimetable)
  const removeTimetable = useAppStore((s) => s.removeTimetable)
  const renameTimetable = useAppStore((s) => s.renameTimetable)

  const entries: CourseEntry[] = []
  selectedCourses.forEach((course, idx) => {
    const chosenIds = manualSelections[course.code] || []
    const secs = course.sections || []
    let sections: Section[] = []
    if (chosenIds.length > 0) {
      sections = secs.filter((s) => chosenIds.includes(s.sectionId))
    } else {
      // Fallback: show first L + first T section
      const lec = secs.find((s) => s.sectionType === 'L')
      const tut = secs.find((s) => s.sectionType === 'T')
      if (lec) sections.push(lec)
      if (tut) sections.push(tut)
    }

    sections.forEach((sec) => {
      sec.timeSlots.forEach((ts) => {
        entries.push({
          courseCode: course.code,
          title: course.title,
          sectionId: sec.sectionId,
          instructor: sec.instructor,
          color: COURSE_COLORS[idx % COURSE_COLORS.length],
          day: ts.day,
          startMin: timeToMinutes(ts.startTime),
          endMin: timeToMinutes(ts.endTime),
          venue: ts.venue,
        })
      })
    })
  })

  // Conflict detection
  const entryConflicts = new Set<number>()
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j]
      if (a.day === b.day && a.startMin < b.endMin && b.startMin < a.endMin) {
        entryConflicts.add(i)
        entryConflicts.add(j)
      }
    }
  }

  const BASE_MIN = 8 * 60 // 8:00

  if (selectedCourses.length === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        {/* Tab bar — still show even when empty */}
        <div className="flex items-center gap-1 mb-3">
          {timetableTabs.map((tab) => (
            <div key={tab.id} className="group flex items-center">
              <button
                onClick={() => switchTimetable(tab.id)}
                onDoubleClick={() => {
                  const name = prompt(t('timetable.renamePrompt'), tab.name)
                  if (name && name.trim()) renameTimetable(tab.id, name.trim())
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border border-b-0 transition-colors ${
                  tab.id === activeTimetableId
                    ? 'bg-white text-[#003366] border-slate-200'
                    : 'bg-slate-100 text-slate-500 border-transparent hover:bg-slate-200'
                }`}
              >
                {tab.name}
              </button>
              {timetableTabs.length > 1 && (
                <button
                  onClick={() => removeTimetable(tab.id)}
                  className="ml-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all"
                  title={t('timetable.deleteTimetable')}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addTimetable}
            className="px-2 py-1.5 text-xs rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-[#003366] hover:text-[#003366] transition-colors"
            title={t('timetable.newTimetable')}
          >
            <Plus size={12} className="inline mr-0.5" />
            {t('timetable.new')}
          </button>
        </div>

        <div className="flex flex-col items-center justify-center h-full text-slate-400 pt-12">
          <div className="text-6xl mb-4">🔴</div>
          <p className="text-lg font-medium text-slate-500 mb-2">{t('timetable.welcome')}</p>
          <p className="text-sm max-w-md text-center">
            {t('timetable.emptyHint1')}<br />
            {t('timetable.emptyHint2')}<br />
            {t('timetable.emptyHint3')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-3">
        {timetableTabs.map((tab) => (
          <div key={tab.id} className="group flex items-center">
            <button
              onClick={() => switchTimetable(tab.id)}
              onDoubleClick={() => {
                const name = prompt(t('timetable.renamePrompt'), tab.name)
                if (name && name.trim()) renameTimetable(tab.id, name.trim())
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border border-b-0 transition-colors ${
                tab.id === activeTimetableId
                  ? 'bg-white text-[#003366] border-slate-200'
                  : 'bg-slate-100 text-slate-500 border-transparent hover:bg-slate-200'
              }`}
            >
              {tab.name}
            </button>
            {timetableTabs.length > 1 && (
              <button
                onClick={() => removeTimetable(tab.id)}
                className="ml-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all"
                title={t('timetable.deleteTimetable')}
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addTimetable}
          className="px-2 py-1.5 text-xs rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-[#003366] hover:text-[#003366] transition-colors"
          title={t('timetable.newTimetable')}
        >
          <Plus size={12} className="inline mr-0.5" />
          {t('timetable.new')}
        </button>
      </div>

      {/* Timetable container */}
      <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-white" style={{ paddingLeft: TIME_COL_WIDTH }}>
        {/* Header row */}
        <div className="flex h-7 bg-[#003366] text-white text-[11px] font-semibold" style={{ marginLeft: -TIME_COL_WIDTH }}>
          <div className="flex items-center justify-end pr-1.5" style={{ width: TIME_COL_WIDTH }}>{t('timetable.timeColumn')}</div>
          {DAYS.map((day) => (
            <div key={day} className="flex-1 flex items-center justify-center border-l border-white/20">
              {t(DAY_LABELS[day])}
            </div>
          ))}
        </div>

        {/* Grid background: half-hour lines */}
        <div className="relative" style={{ height: GRID_HEIGHT, marginLeft: -TIME_COL_WIDTH }}>
          {/* Time labels — whole hours only */}
          {HALF_HOURS.filter((t) => t.endsWith(':00')).map((tl) => {
            const idx = HALF_HOURS.indexOf(tl)
            return (
              <div
                key={`tl-${idx}`}
                className="absolute left-0 text-[10px] text-slate-400 text-right pr-1.5 leading-none"
                style={{ top: idx * SLOT_HEIGHT, width: TIME_COL_WIDTH - 4, height: SLOT_HEIGHT, lineHeight: `${SLOT_HEIGHT}px` }}
              >
                {tl}
              </div>
            )
          })}

          {/* Vertical day separators */}
          {DAYS.map((_, di) => (
            <div
              key={`vl-${di}`}
              className="absolute top-0 bottom-0 border-l border-slate-100"
              style={{ left: TIME_COL_WIDTH + di * ((100 - TIME_COL_WIDTH / 6) / 5) }} // need fixed calc
            />
          ))}

          {/* Horizontal half-hour lines */}
          {HALF_HOURS.map((_, idx) => (
            <div
              key={`hl-${idx}`}
              className="absolute left-0 right-0 border-t border-slate-100"
              style={{ top: idx * SLOT_HEIGHT }}
            />
          ))}
          {/* Hour lines (darker) */}
          {HALF_HOURS.filter((t) => t.endsWith(':00')).map((t) => {
            const idx = HALF_HOURS.indexOf(t)
            return (
              <div
                key={`hh-${idx}`}
                className="absolute left-0 right-0 border-t border-slate-200"
                style={{ top: idx * SLOT_HEIGHT }}
              />
            )
          })}

          {/* Course blocks — absolutely positioned */}
          {entries.map((entry, i) => {
            const di = DAYS.indexOf(entry.day as DayOfWeek)
            const topPx = ((entry.startMin - BASE_MIN) / 30) * SLOT_HEIGHT
            const heightPx = ((entry.endMin - entry.startMin) / 30) * SLOT_HEIGHT
            const isConflict = entryConflicts.has(i)

            // Use inline style with calc for responsive day columns
            return (
              <div
                key={i}
                onClick={() => {
                  const course = selectedCourses.find(c => c.code === entry.courseCode)
                  if (course) openDetail(course)
                }}
                className={`
                  absolute rounded-sm px-1.5 py-0.5 cursor-pointer overflow-hidden
                  text-[10px] leading-tight z-10 transition-opacity hover:opacity-85
                  ${isConflict ? 'ring-2 ring-red-400' : ''}
                `}
                style={{
                  left: `calc(${TIME_COL_WIDTH}px + ${di} * (100% - ${TIME_COL_WIDTH}px) / ${DAYS.length} + 4px)`,
                  width: `calc((100% - ${TIME_COL_WIDTH}px) / ${DAYS.length} - 8px)`,
                  top: topPx,
                  height: Math.max(heightPx, SLOT_HEIGHT),
                  backgroundColor: entry.color + '18',
                  borderLeft: `3px solid ${entry.color}`,
                  color: entry.color,
                }}
                title={`${entry.courseCode}: ${entry.title}\n${entry.sectionId} (${entry.instructor})\n${entry.startMin / 60 | 0}:${String(entry.startMin % 60).padStart(2, '0')}-${entry.endMin / 60 | 0}:${String(entry.endMin % 60).padStart(2, '0')}\n${entry.venue || 'TBA'}${isConflict ? `\n⚠ ${t('timetable.conflict')}` : ''}`}
              >
                <div className="font-semibold text-[11px] leading-tight truncate">
                  {entry.courseCode.split(' ')[1]} {entry.sectionId.replace(entry.courseCode.replace(' ', ''), '').replace('-', '')}
                </div>
                <div className="text-[9px] leading-tight opacity-80">
                  {String(Math.floor(entry.startMin / 60)).padStart(2, '0')}:{String(entry.startMin % 60).padStart(2, '0')}-
                  {String(Math.floor(entry.endMin / 60)).padStart(2, '0')}:{String(entry.endMin % 60).padStart(2, '0')}
                </div>
                <div className="text-[9px] leading-tight opacity-80 truncate">{entry.venue || 'TBA'}</div>
                {isConflict && <span className="absolute top-0.5 right-0.5 text-red-500 text-[8px]">⚠</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
