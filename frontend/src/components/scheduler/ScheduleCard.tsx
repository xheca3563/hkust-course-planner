import { Calendar, Clock, Star } from 'lucide-react'
import { useT } from '@/i18n'
import type { ScheduleResult } from '@/types'

interface ScheduleCardProps {
  result: ScheduleResult
  isSelected: boolean
  isFavorited: boolean
  onSelect: () => void
  onFavorite: () => void
}

export function ScheduleCard({
  result,
  isSelected,
  isFavorited,
  onSelect,
  onFavorite,
}: ScheduleCardProps) {
  const t = useT()
  const stats = result.stats

  return (
    <div
      onClick={onSelect}
      className={`schedule-card p-2.5 cursor-pointer ${isSelected ? 'selected' : ''}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-500">
          <Calendar size={10} className="inline mr-1" />
          {t('scheduler.daysHours', { days: stats.daysWithClasses, hours: stats.totalHours })}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite() }}
          className={`p-0.5 ${isFavorited ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
        >
          <Star size={12} fill={isFavorited ? '#D69E2E' : 'none'} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <Clock size={10} />
        <span>{stats.earliestStart} — {stats.latestEnd}</span>
      </div>

      <div className="mt-1.5 text-[10px] text-slate-400 truncate">
        {result.sections.slice(0, 4).map(s => s.courseCode.split(' ')[1] || s.courseCode).join(', ')}
        {result.sections.length > 4 && ` +${result.sections.length - 4}`}
      </div>
    </div>
  )
}
