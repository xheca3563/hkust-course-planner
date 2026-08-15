import { useAppStore } from '@/stores/appStore'
import type { DayOfWeek } from '@/types'
import { useT, type TKey } from '@/i18n'

const DAY_OPTIONS: { value: DayOfWeek | ''; labelKey: TKey }[] = [
  { value: '', labelKey: 'constraints.dayNone' },
  { value: 'Mon', labelKey: 'constraints.dayMon' },
  { value: 'Tue', labelKey: 'constraints.dayTue' },
  { value: 'Wed', labelKey: 'constraints.dayWed' },
  { value: 'Thu', labelKey: 'constraints.dayThu' },
  { value: 'Fri', labelKey: 'constraints.dayFri' },
]

export function ConstraintPanel() {
  const t = useT()
  const constraints = useAppStore((s) => s.constraints)
  const updateConstraint = useAppStore((s) => s.updateConstraint)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-2.5">
      <h3 className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
        ⚙️ {t('constraints.title')}
      </h3>

      <div className="space-y-1">
        {/* Avoid noon back-to-back */}
        <label className="constraint-item cursor-pointer">
          <input
            type="checkbox"
            checked={constraints.avoidNoonBackToBack}
            onChange={(e) => updateConstraint('avoidNoonBackToBack', e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#003366] focus:ring-[#003366]"
          />
          <span className="text-xs text-slate-700">{t('constraints.avoidNoonBackToBack')}</span>
          <span className="text-xs text-slate-400 ml-auto">
            {t('constraints.noonGap', { start: constraints.noonStart, end: constraints.noonEnd })}
          </span>
        </label>

        {/* No evening classes */}
        <label className="constraint-item cursor-pointer">
          <input
            type="checkbox"
            checked={constraints.noEveningClasses}
            onChange={(e) => updateConstraint('noEveningClasses', e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#003366] focus:ring-[#003366]"
          />
          <span className="text-xs text-slate-700">{t('constraints.noEveningClasses')}</span>
          <span className="text-xs text-slate-400 ml-auto">
            {t('constraints.eveningCutoff', { time: constraints.eveningCutoff })}
          </span>
        </label>

        {/* Day off */}
        <div className="constraint-item">
          <span className="text-xs text-slate-700">{t('constraints.dayOff')}</span>
          <select
            value={constraints.dayOff || ''}
            onChange={(e) =>
              updateConstraint('dayOff', (e.target.value || null) as DayOfWeek | null)
            }
            className="ml-auto text-xs border border-slate-200 rounded-md px-2 py-1
                       focus:outline-none focus:ring-2 focus:ring-[#003366]/20"
          >
            {DAY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>

        {/* Min professor rating */}
        <div className="constraint-item">
          <span className="text-xs text-slate-700">{t('constraints.minProfessorRating')}</span>
          <select
            value={constraints.minProfessorRating}
            onChange={(e) => updateConstraint('minProfessorRating', Number(e.target.value))}
            className="ml-auto text-xs border border-slate-200 rounded-md px-2 py-1
                       focus:outline-none focus:ring-2 focus:ring-[#003366]/20"
          >
            <option value={0}>{t('constraints.ratingNone')}</option>
            <option value={2.0}>{t('constraints.ratingC')}</option>
            <option value={2.7}>{t('constraints.ratingBMinus')}</option>
            <option value={3.0}>{t('constraints.ratingB')}</option>
            <option value={3.3}>{t('constraints.ratingBPlus')}</option>
            <option value={3.7}>{t('constraints.ratingAMinus')}</option>
            <option value={4.0}>{t('constraints.ratingA')}</option>
          </select>
        </div>

        {/* Preferred time range */}
        <div className="pt-1.5 border-t border-slate-100 mt-1.5">
          <p className="text-[10px] text-slate-500 mb-1.5">{t('constraints.preferredTimeRange')}</p>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={constraints.preferredStartTime}
              onChange={(e) => updateConstraint('preferredStartTime', e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-md px-2 py-1
                         focus:outline-none focus:ring-2 focus:ring-[#003366]/20"
              placeholder={t('constraints.earliestPlaceholder')}
            />
            <span className="text-xs text-slate-400">{t('constraints.to')}</span>
            <input
              type="time"
              value={constraints.preferredEndTime}
              onChange={(e) => updateConstraint('preferredEndTime', e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-md px-2 py-1
                         focus:outline-none focus:ring-2 focus:ring-[#003366]/20"
              placeholder={t('constraints.latestPlaceholder')}
            />
          </div>
        </div>
      </div>

    </div>
  )
}
