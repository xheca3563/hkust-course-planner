import { useAppStore } from '@/stores/appStore'
import { useT } from '@/i18n'

export function StatusBar() {
  const t = useT()
  const mode = useAppStore((s) => s.mode)
  const selectedCourses = useAppStore((s) => s.selectedCourses)
  const scheduleResults = useAppStore((s) => s.scheduleResults)
  const totalCredits = selectedCourses.reduce((sum, c) => sum + (c.credits || 0), 0)

  return (
    <footer className="flex items-center justify-between h-8 px-4 bg-white border-t border-slate-200 flex-shrink-0 text-[11px] text-slate-500">
      <div className="flex items-center gap-4">
        <span>
          {t('layout.selected')} <strong className="text-slate-700">{selectedCourses.length}</strong>{t('layout.selectedUnit')}
        </span>
        <span>
          {t('layout.credits')} <strong className="text-slate-700">{totalCredits}</strong>
        </span>
        {mode === 'smart' && scheduleResults.length > 0 && (
          <span>
            {t('layout.schedules')} <strong className="text-[#003366]">{scheduleResults.length}</strong>{t('layout.schedulesUnit')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-slate-400">
          {mode === 'manual' ? t('layout.modeManual') : t('layout.modeSmart')} · CoursePlanner v0.1
        </span>
      </div>
    </footer>
  )
}
