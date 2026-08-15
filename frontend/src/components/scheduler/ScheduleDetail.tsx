import type { ScheduleResult, DayOfWeek } from '@/types'
import { useT } from '@/i18n'

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const COURSE_COLORS = [
  '#003366', '#C8962E', '#2E7D32', '#C62828', '#6A1B9A',
  '#00838F', '#D84315', '#4527A0',
]

// Visual constants (matching TimetableView)
const TIME_COL_WIDTH = 48
const SLOT_HEIGHT = 14

interface Props {
  result: ScheduleResult
}

interface FlatEntry {
  courseCode: string
  sectionId: string
  sectionType: string
  color: string
  day: string
  startMin: number
  endMin: number
  venue: string
}

export function ScheduleDetail({ result }: Props) {
  const t = useT()
  if (!result?.sections || result.sections.length === 0) {
    return <div className="text-xs text-slate-400 p-4 text-center">{t('scheduler.noCourses')}</div>
  }

  // Flatten sections into entries with time slots
  const entries: FlatEntry[] = []
  result.sections.forEach((sec, idx) => {
    if (!sec.timeSlots) return
    sec.timeSlots.forEach((ts) => {
      entries.push({
        courseCode: sec.courseCode,
        sectionId: sec.sectionId,
        sectionType: sec.sectionType,
        color: COURSE_COLORS[idx % COURSE_COLORS.length],
        day: ts.day,
        startMin: timeToMinutes(ts.startTime),
        endMin: timeToMinutes(ts.endTime),
        venue: ts.venue,
      })
    })
  })

  if (entries.length === 0) {
    return <div className="text-xs text-slate-400 p-4 text-center">{t('scheduler.noTimeSlots')}</div>
  }

  // Determine time range
  let minTime = 8 * 60, maxTime = 20 * 60
  for (const e of entries) {
    minTime = Math.min(minTime, e.startMin)
    maxTime = Math.max(maxTime, e.endMin)
  }
  minTime = Math.floor(minTime / 60) * 60
  maxTime = Math.ceil(maxTime / 60) * 60

  // Build half-hour slots
  const halfHours: string[] = []
  for (let m = minTime; m < maxTime; m += 30) {
    const hh = Math.floor(m / 60)
    const mm = m % 60
    halfHours.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
  }

  const totalSlots = halfHours.length
  const gridHeight = totalSlots * SLOT_HEIGHT
  const BASE_MIN = minTime

  // Always use full DAYS order for positioning so header and blocks align
  const dayCount = Math.max(5, DAYS.filter(d => entries.some(e => e.day === d)).length)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="relative" style={{ paddingLeft: TIME_COL_WIDTH }}>
        {/* Header row */}
        <div className="flex h-7 bg-[#003366] text-white text-[11px] font-semibold" style={{ marginLeft: -TIME_COL_WIDTH }}>
          <div className="flex items-center justify-end pr-1.5" style={{ width: TIME_COL_WIDTH }}>{t('scheduler.timeColumn')}</div>
          {DAYS.slice(0, dayCount).map((day) => (
            <div key={day} className="flex-1 flex items-center justify-center border-l border-white/20 text-[10px]">
              {day}
            </div>
          ))}
        </div>

        {/* Grid background + course blocks */}
        <div className="relative" style={{ height: gridHeight, marginLeft: -TIME_COL_WIDTH }}>
          {/* Time labels — whole hours only */}
          {halfHours.filter((t) => t.endsWith(':00')).map((tl) => {
            const idx = halfHours.indexOf(tl)
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

          {/* Horizontal half-hour lines */}
          {halfHours.map((_, idx) => (
            <div
              key={`hl-${idx}`}
              className="absolute left-0 right-0 border-t border-slate-100"
              style={{ top: idx * SLOT_HEIGHT }}
            />
          ))}
          {/* Hour lines (darker) */}
          {halfHours.filter((t) => t.endsWith(':00')).map((t) => {
            const idx = halfHours.indexOf(t)
            return (
              <div
                key={`hh-${idx}`}
                className="absolute left-0 right-0 border-t border-slate-200"
                style={{ top: idx * SLOT_HEIGHT }}
              />
            )
          })}

          {/* Course blocks — absolute positioned */}
          {entries.map((entry, i) => {
            const di = DAYS.indexOf(entry.day as DayOfWeek)
            if (di === -1 || di >= dayCount) return null
            const topPx = ((entry.startMin - BASE_MIN) / 30) * SLOT_HEIGHT
            const heightPx = ((entry.endMin - entry.startMin) / 30) * SLOT_HEIGHT

            return (
              <div
                key={i}
                className={`absolute rounded-sm px-1.5 py-0.5 overflow-hidden text-[10px] leading-tight z-10`}
                style={{
                  left: `calc(${TIME_COL_WIDTH}px + ${di} * (100% - ${TIME_COL_WIDTH}px) / ${dayCount} + 4px)`,
                  width: `calc((100% - ${TIME_COL_WIDTH}px) / ${dayCount} - 8px)`,
                  top: topPx,
                  height: Math.max(heightPx, SLOT_HEIGHT),
                  backgroundColor: entry.color + '18',
                  borderLeft: `3px solid ${entry.color}`,
                  color: entry.color,
                }}
              >
                <div className="font-semibold text-[11px] leading-tight truncate">
                  {entry.courseCode.split(' ')[1]} {entry.sectionId.replace(entry.courseCode.replace(' ', ''), '').replace('-', '')}
                </div>
                <div className="text-[9px] leading-tight opacity-80">
                  {String(Math.floor(entry.startMin / 60)).padStart(2, '0')}:{String(entry.startMin % 60).padStart(2, '0')}-
                  {String(Math.floor(entry.endMin / 60)).padStart(2, '0')}:{String(entry.endMin % 60).padStart(2, '0')}
                </div>
                <div className="text-[9px] leading-tight opacity-80 truncate">{entry.venue || 'TBA'}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
