import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useT } from '@/i18n'
import { ScheduleDetail } from '@/components/scheduler/ScheduleDetail'
import { Star, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  onClose: () => void
}

export function ComparisonView({ onClose }: Props) {
  const t = useT()
  const favorites = useAppStore((s) => s.favorites)
  const scheduleResults = useAppStore((s) => s.scheduleResults)
  const toggleFavorite = useAppStore((s) => s.toggleFavorite)

  const favSchedules = scheduleResults.filter((r) => favorites.includes(r.id))
  if (favSchedules.length < 2) {
    onClose()
    return null
  }

  const [idx, setIdx] = useState(0)
  const current = favSchedules[idx]

  return (
    <div className="space-y-3">
      {/* Merged: title + navigation + close */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 flex-shrink-0">
          <Star size={16} className="text-amber-500" fill="#D69E2E" />
          {t('scheduler.compareTitle')}
        </h3>

        <button
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          className="p-1 rounded hover:bg-slate-100 disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
        >
          <ChevronLeft size={16} className="text-[#003366]" />
        </button>

        <div className="flex items-center gap-1">
          {favSchedules.map((r, i) => (
            <button
              key={r.id}
              onClick={() => setIdx(i)}
              className={`w-6 h-5 rounded text-[11px] font-medium transition-colors ${
                i === idx
                  ? 'bg-[#003366] text-white'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-[#003366]'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <button
          onClick={() => setIdx(Math.min(favSchedules.length - 1, idx + 1))}
          disabled={idx >= favSchedules.length - 1}
          className="p-1 rounded hover:bg-slate-100 disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
        >
          <ChevronRight size={16} className="text-[#003366]" />
        </button>

        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded ml-auto flex-shrink-0">
          <X size={16} className="text-slate-400" />
        </button>
      </div>

      {/* Current timetable */}
      {current && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600">
              {t('scheduler.scheduleNofM', { n: idx + 1, total: favSchedules.length })}
            </span>
            <button
              onClick={() => toggleFavorite(current.id)}
              className="text-xs text-amber-500 hover:text-amber-600 flex items-center gap-1"
            >
              <Star size={12} fill="#D69E2E" />
              {t('scheduler.removeFavorite')}
            </button>
          </div>

          {/* Stats — compact row */}
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            <div className="bg-slate-50 rounded-lg p-1.5 text-center">
              <div className="text-sm font-bold text-[#003366]">{current.stats.daysWithClasses}</div>
              <div className="text-[10px] text-slate-400">{t('scheduler.daysOnCampus')}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-1.5 text-center">
              <div className="text-sm font-bold text-[#003366]">{current.stats.earliestStart}</div>
              <div className="text-[10px] text-slate-400">{t('scheduler.earliestStart')}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-1.5 text-center">
              <div className="text-sm font-bold text-[#003366]">{current.stats.latestEnd}</div>
              <div className="text-[10px] text-slate-400">{t('scheduler.latestEnd')}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-1.5 text-center">
              <div className="text-sm font-bold text-[#003366]">{current.stats.totalGapHours}h</div>
              <div className="text-[10px] text-slate-400">{t('scheduler.totalFreeTime')}</div>
            </div>
          </div>

          <ScheduleDetail result={current} />
        </div>
      )}
    </div>
  )
}
