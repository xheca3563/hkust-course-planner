import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useT } from '@/i18n'
import { ScheduleDetail } from '@/components/scheduler/ScheduleDetail'
import { Star, X, ChevronLeft, ChevronRight } from 'lucide-react'

export function FavoritesView() {
  const t = useT()
  const favorites = useAppStore((s) => s.favorites)
  const scheduleResults = useAppStore((s) => s.scheduleResults)
  const toggleFavorite = useAppStore((s) => s.toggleFavorite)
  const setShowComparison = useAppStore((s) => s.setShowComparison)

  const favSchedules = scheduleResults.filter((r) => favorites.includes(r.id))
  if (favSchedules.length === 0) return null

  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const current = favSchedules[idx]

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                   bg-amber-50 text-amber-700 border border-amber-200
                   hover:bg-amber-100 transition-colors"
      >
        <Star size={13} fill="#D69E2E" className="text-amber-500" />
        {t('scheduler.myFavoritesCount', { n: favSchedules.length })}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Star size={16} className="text-amber-500" fill="#D69E2E" />
            {t('scheduler.myFavorites')}
          </h3>
          <div className="flex items-center gap-2">
            {favSchedules.length >= 2 && (
              <button
                onClick={() => { setOpen(false); setShowComparison(true) }}
                className="px-3 py-1 text-xs font-medium rounded-lg border border-[#C8962E] text-[#C8962E]
                           hover:bg-[#C8962E] hover:text-white transition-colors"
              >
                {t('scheduler.sideBySideCompare')}
              </button>
            )}
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-slate-100 rounded">
              <X size={18} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Navigation dots */}
        <div className="flex items-center justify-center gap-3 px-5 py-2 bg-slate-50">
          <button
            onClick={() => setIdx(Math.max(0, idx - 1))}
            disabled={idx === 0}
            className="p-1 rounded hover:bg-slate-200 disabled:opacity-20"
          >
            <ChevronLeft size={18} className="text-[#003366]" />
          </button>

          <div className="flex items-center gap-1">
            {favSchedules.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setIdx(i)}
                className={`w-7 h-6 rounded text-xs font-medium transition-colors ${
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
            className="p-1 rounded hover:bg-slate-200 disabled:opacity-20"
          >
            <ChevronRight size={18} className="text-[#003366]" />
          </button>
        </div>

        {/* Current favorite timetable */}
        {current && (
          <div className="p-4 space-y-3">
            {/* Compact stats */}
            <div className="grid grid-cols-4 gap-1.5">
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

            <div className="flex justify-end">
              <button
                onClick={() => toggleFavorite(current.id)}
                className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
              >
                <Star size={12} fill="#D69E2E" />
                {t('scheduler.removeFavorite')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
