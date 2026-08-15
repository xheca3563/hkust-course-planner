import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { calculateProgress } from '@/lib/api'
import type { GraduationProgress, ProgressGroup } from '@/types'
import { useT } from '@/i18n'
import {
  AlertTriangle, CheckCircle2, Circle, GraduationCap, Info, Loader2, RefreshCw,
} from 'lucide-react'

/* ── shared meter ────────────────────────────────────────────────────── */

/** Thin status meter: completed (emerald) + planned (amber) over a slate
 *  track.  Status is always accompanied by an icon/text elsewhere —
 *  color is never the only signal. */
function Meter({
  completed, required, planned = 0,
}: { completed: number; required: number; planned?: number }) {
  if (required <= 0) return null
  const pct = (v: number) => Math.max(0, Math.min(100, (v / required) * 100))
  return (
    <div className="h-2 flex-1 min-w-16 bg-slate-200 rounded-full overflow-hidden flex gap-0.5">
      {completed > 0 && (
        <div className="bg-emerald-500 rounded-full" style={{ width: `${pct(completed)}%` }} />
      )}
      {planned > 0 && (
        <div className="bg-amber-400 rounded-full" style={{ width: `${pct(planned)}%` }} />
      )}
    </div>
  )
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
    : <Circle size={16} className="text-slate-300 flex-shrink-0" />
}

/** One row: icon + label + meter + "x / y" */
function MeterRow({
  ok, label, completed, required, planned = 0, tag, detail,
}: {
  ok: boolean
  label?: string
  completed: number
  required: number
  planned?: number
  tag?: string
  detail?: string
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <StatusIcon ok={ok} />
      <span className="w-44 flex-shrink-0 text-sm text-slate-700 flex items-center gap-1.5">
        {label}
        {tag && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
            {tag}
          </span>
        )}
      </span>
      <Meter completed={completed} required={required} planned={planned} />
      <span className="w-14 flex-shrink-0 text-right text-xs tabular-nums text-slate-500">
        {completed}{planned > 0 ? `+${planned}` : ''} / {required}
      </span>
      {detail && <span className="flex-shrink-0 text-[11px] text-slate-400 max-w-52 truncate" title={detail}>{detail}</span>}
    </div>
  )
}

function SectionCard({ title, right, children }: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

/** List of requirement groups: satisfied courses (green) + missing (gray) */
function GroupList({ groups }: { groups: ProgressGroup[] }) {
  const t = useT()
  if (groups.length === 0) {
    return <p className="text-xs text-slate-400">{t('progress.noTemplateData')}</p>
  }
  return (
    <ul className="space-y-1.5">
      {groups.map((g, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="mt-0.5"><StatusIcon ok={g.satisfied} /></span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-700">{g.subject}</span>
              {g.category === 'track' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                  {t('progress.trackTag')}
                </span>
              )}
              {g.note && (
                <span className="text-[11px] text-slate-400 truncate max-w-72" title={g.note}>
                  <Info size={10} className="inline mr-0.5 -mt-0.5" />{g.note}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-wrap mt-0.5">
              {g.completed.map((c) => (
                <span key={c.code}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                  {c.code}
                </span>
              ))}
              {g.missing.slice(0, 6).map((c) => (
                <span key={c.code}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">
                  {c.code}
                </span>
              ))}
              {g.missing.length > 6 && (
                <span className="text-[10px] text-slate-400">{t('progress.moreOthers', { n: g.missing.length - 6 })}</span>
              )}
              {!g.satisfied && g.minCredits > 0 && (
                <span className="text-[10px] text-slate-400">
                  {t('progress.needsCredits', { n: g.minCredits })}
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ── main component ──────────────────────────────────────────────────── */

export function ProgressTracker() {
  const t = useT()
  const profile = useAppStore((s) => s.profile)
  const selectedCourses = useAppStore((s) => s.selectedCourses)

  const [report, setReport] = useState<GraduationProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const configured = Boolean(profile.major && profile.admissionYear)

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    setLoading(true)
    setError(null)
    calculateProgress(
      profile.major!,
      profile.admissionYear!,
      profile.completedCourses,
      selectedCourses.map((c) => c.code),
      profile.track,
    )
      .then((r) => { if (!cancelled) { setReport(r); setLoading(false) } })
      .catch((e: Error) => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [configured, profile.major, profile.admissionYear,
      profile.completedCourses.length, selectedCourses.length, profile.track])

  if (!configured) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        <div className="text-center space-y-2">
          <GraduationCap className="mx-auto" size={48} strokeWidth={1.5} opacity={0.4} />
          <p>{t('progress.emptyTitle')}</p>
          <p className="text-xs">{t('progress.emptyHint')}</p>
        </div>
      </div>
    )
  }

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  if (error && !report) {
    return (
      <div className="flex items-center justify-center h-full text-sm">
        <div className="text-center space-y-3">
          <AlertTriangle className="mx-auto text-amber-500" size={32} />
          <p className="text-slate-600">{t('progress.calcFailed')}</p>
          <p className="text-xs text-slate-400 max-w-sm">{error}</p>
          <button
            onClick={() => setReport(null)}
            className="text-xs px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 mx-auto"
          >
            <RefreshCw size={12} /> {t('progress.retry')}
          </button>
        </div>
      </div>
    )
  }

  if (!report) return null

  const cc = report.commonCore
  const comp = cc.components
  const adj = profile.creditsAdjustment
  const totalDone = report.summary.totalCompleted + adj
  const totalPlanned = Math.max(0, report.summary.totalWithPlanned - report.summary.totalCompleted)

  return (
    <div className="max-w-3xl mx-auto space-y-3 pb-6">
      {/* ── header + overall ── */}
      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              {report.program.name}
              {report.summary.graduationReady && (
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  {t('progress.graduationReady')}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {report.program.code} · {t('progress.admittedYear', { year: report.program.admitYear })}
              {report.programRequirements.track && (
                <> · {report.programRequirements.track}</>
              )}
              {report.program.templateYear !== report.program.admitYear && (
                <>{t('progress.usingTemplate', { year: report.program.templateYear })}</>
              )}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
              {totalDone}<span className="text-sm font-normal text-slate-400">/{report.summary.totalRequired}</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {t('progress.creditsEarned')}
              {adj > 0 ? t('progress.inclAdjustment', { n: adj }) : ''}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Meter completed={totalDone} required={report.summary.totalRequired} planned={totalPlanned} />
          <span className="text-xs text-slate-500 flex-shrink-0">
            {totalPlanned > 0
              ? t('progress.plannedThisYear', { n: totalPlanned })
              : t('progress.remainingCredits', { n: report.summary.remaining - adj > 0 ? report.summary.remaining - adj : 0 })}
          </span>
        </div>
      </section>

      {/* ── Common Core ── */}
      <SectionCard
        title={t('progress.commonCoreTitle')}
        right={(
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            {cc.satisfied ? t('progress.ccMet') : t('progress.ccNotMet')}
            <StatusIcon ok={cc.satisfied} />
            <span className="font-semibold tabular-nums">{cc.completed} / {cc.required}</span>
          </span>
        )}
      >
        <div className="space-y-0.5">
          <MeterRow ok={comp.hmw.satisfied} label={t('progress.hmwLabel')}
            completed={comp.hmw.completed} required={1}
            detail={comp.hmw.courses.join('、')} />
          <MeterRow ok={comp.eComm.satisfied} label={t('progress.eCommLabel')}
            completed={comp.eComm.completed} required={comp.eComm.required}
            detail={comp.eComm.courses.join('、')} />
          <MeterRow ok={comp.cComm.satisfied} label={t('progress.cCommLabel')}
            completed={comp.cComm.completed} required={comp.cComm.required}
            detail={comp.cComm.courses.join('、')} />
          <MeterRow ok={comp.literacy.satisfied} label={comp.literacy.label}
            completed={comp.literacy.completed} required={comp.literacy.required}
            tag={comp.literacy.substituted ? t('progress.substituted') : t('progress.substitutable')}
            detail={comp.literacy.substituted
              ? t('progress.substitutionDetail', { n: comp.literacy.substituteCredits })
              : comp.literacy.courses.join('、')} />
          <MeterRow ok={comp.uxop.satisfied} label={t('progress.uxopLabel')}
            completed={comp.uxop.completed} required={comp.uxop.required}
            tag={comp.uxop.substituted ? t('progress.substituted') : t('progress.substitutable')}
            detail={comp.uxop.substituted
              ? t('progress.substitutionDetail', { n: comp.uxop.substituteCredits })
              : comp.uxop.courses.join('、')} />
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold text-slate-700">{t('progress.broadeningTitle')}</h3>
            <span className="text-[11px] text-slate-400">
              {t('progress.broadeningHeader', {
                areas: cc.homeAreas.length ? cc.homeAreas.join('、') : t('progress.unknown'),
                n: comp.broadening.nonHomeTotal.required,
              })}
            </span>
          </div>
          <div className="space-y-0.5">
            {comp.broadening.areas.map((a) => (
              <MeterRow key={a.area} ok={a.satisfied} label={a.home ? t('progress.areaHome', { area: a.area }) : a.area}
                completed={a.completed} required={a.required}
                detail={a.courses.join('、')} />
            ))}
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-dashed border-slate-100 space-y-0.5">
            <MeterRow ok={comp.broadening.nonHomeTotal.satisfied} label={t('progress.nonHomeTotal')}
              completed={comp.broadening.nonHomeTotal.completed}
              required={comp.broadening.nonHomeTotal.required} />
            {comp.broadening.floorRemainder.required > 0 && (
              <MeterRow ok={comp.broadening.floorRemainder.satisfied} label={t('progress.floorRemainder')}
                completed={comp.broadening.floorRemainder.completed}
                required={comp.broadening.floorRemainder.required}
                detail={t('progress.jointProgramFloor')} />
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── school requirements ── */}
      {(() => {
        const schoolGroups = report.programRequirements.groups.filter(
          (g) => g.category === 'school')
        if (schoolGroups.length === 0) return null
        return (
          <SectionCard
            title={t('progress.schoolReqTitle')}
            right={(
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                {t('progress.itemsCount', {
                  done: schoolGroups.filter((g) => g.satisfied).length,
                  total: schoolGroups.length,
                })}
                <StatusIcon ok={schoolGroups.every((g) => g.satisfied)} />
              </span>
            )}
          >
            <GroupList groups={schoolGroups} />
          </SectionCard>
        )
      })()}

      {/* ── major requirements (incl. selected track) ── */}
      <SectionCard
        title={report.programRequirements.track
          ? t('progress.majorReqTitleWithTrack', { track: report.programRequirements.track })
          : t('progress.majorReqTitle')}
        right={(
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            {t('progress.itemsCount', {
              done: report.programRequirements.groups.filter((g) => g.category !== 'school' && g.satisfied).length,
              total: report.programRequirements.groups.filter((g) => g.category !== 'school').length,
            })}
            <StatusIcon ok={
              report.programRequirements.groups
                .filter((g) => g.category !== 'school')
                .every((g) => g.satisfied)
            } />
          </span>
        )}
      >
        {report.programRequirements.trackRequired && !report.programRequirements.track && (
          <p className="flex items-start gap-1.5 text-xs text-amber-600 mb-2">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
            {t('progress.trackRequiredWarning')}
          </p>
        )}
        <GroupList groups={report.programRequirements.groups.filter((g) => g.category !== 'school')} />
      </SectionCard>

      {/* ── electives ── */}
      {report.electives.length > 0 && (
        <SectionCard title={t('progress.majorElectivesTitle')}>
          <div className="space-y-0.5">
            {report.electives.map((e, i) => (
              <MeterRow key={i} ok={e.satisfied} label={e.subject}
                completed={e.completed} required={e.minCredits}
                detail={e.detail || e.freeForm || undefined} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── free electives ── */}
      <SectionCard title={t('progress.freeElectivesTitle')}>
        <MeterRow ok={report.freeElectives.satisfied} label={t('progress.freeElectivesLabel')}
          completed={report.freeElectives.completed + adj} required={report.freeElectives.required} />
      </SectionCard>

      {/* ── warnings ── */}
      {(report.warnings.length > 0 || report.unmatchedCompleted.length > 0) && (
        <div className="px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 space-y-1">
          {report.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />{w}
            </p>
          ))}
          {report.unmatchedCompleted.length > 0 && (
            <p className="flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              {t('progress.unmatchedWarning', { courses: report.unmatchedCompleted.join('、') })}
            </p>
          )}
        </div>
      )}

      <p className="text-[11px] text-slate-400 text-center">
        {t('progress.footerSource')}
      </p>
    </div>
  )
}
