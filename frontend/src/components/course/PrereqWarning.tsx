import { useAppStore } from '@/stores/appStore'
import { AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react'

interface PrereqWarningBadgeProps {
  courseCode: string
  /** Compact mode: just an icon. Full mode: show details */
  compact?: boolean
}

/** Icon badge shown on CourseCard — indicates prereq/co/exclusion status */
export function PrereqWarningBadge({ courseCode, compact = true }: PrereqWarningBadgeProps) {
  const status = useAppStore((s) => s.prereqStatus[courseCode])

  if (!status) return null

  const hasIssue = !status.prereqSatisfied || !status.coreqSatisfied || status.exclusionConflict
  const hasWarning = status.needsWaiver.length > 0

  if (!hasIssue && !hasWarning) return null

  if (compact) {
    return (
      <span
        className="inline-flex items-center"
        title={
          !status.prereqSatisfied
            ? `Missing prereq: ${status.prereqMissing.join(', ')}`
            : status.exclusionConflict
              ? `Exclusion conflict: ${status.conflictingCourse}`
              : `Needs waiver: ${status.needsWaiver.join(', ')}`
        }
      >
        {status.exclusionConflict ? (
          <AlertTriangle size={14} className="text-red-500" />
        ) : !status.prereqSatisfied || !status.coreqSatisfied ? (
          <AlertTriangle size={14} className="text-amber-500" />
        ) : (
          <AlertCircle size={14} className="text-blue-500" />
        )}
      </span>
    )
  }

  return (
    <div className="space-y-1 mt-1">
      {!status.prereqSatisfied && status.prereqRaw && (
        <div className="flex items-start gap-1.5 text-xs">
          <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <span className="text-amber-700">
            Missing prerequisites: <strong>{status.prereqMissing.join(', ')}</strong>
          </span>
        </div>
      )}
      {!status.coreqSatisfied && status.coreqRaw && (
        <div className="flex items-start gap-1.5 text-xs">
          <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <span className="text-amber-700">
            Missing corequisites: <strong>{status.coreqMissing.join(', ')}</strong>
          </span>
        </div>
      )}
      {status.exclusionConflict && (
        <div className="flex items-start gap-1.5 text-xs">
          <AlertTriangle size={12} className="text-red-500 mt-0.5 flex-shrink-0" />
          <span className="text-red-600">
            Exclusion conflict with <strong>{status.conflictingCourse}</strong>
          </span>
        </div>
      )}
      {hasIssue && status.confidence !== 'exact' && (
        <div className="text-[10px] text-slate-400 ml-5">
          ⚠ Partial parse — may need manual verification
        </div>
      )}
      {!hasIssue && status.prereqRaw && (
        <div className="flex items-start gap-1.5 text-xs">
          <CheckCircle2 size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
          <span className="text-green-600">All requirements satisfied</span>
        </div>
      )}
    </div>
  )
}
