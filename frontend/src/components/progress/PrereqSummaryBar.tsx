import { useAppStore } from '@/stores/appStore'
import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

/** Warning strip shown above the timetable/smart-panel when any selected
 *  course has unmet prerequisites, corequisites, or exclusion conflicts. */
export function PrereqSummaryBar() {
  const prereqStatus = useAppStore((s) => s.prereqStatus)
  const allResults = Object.values(prereqStatus)
  const [dismissed, setDismissed] = useState(false)

  if (allResults.length === 0 || dismissed) return null

  const issues = allResults.filter(
    (r) => !r.prereqSatisfied || !r.coreqSatisfied || r.exclusionConflict
  )
  const waiverNeeded = allResults.filter(
    (r) => r.needsWaiver.length > 0 && r.prereqSatisfied && r.coreqSatisfied && !r.exclusionConflict
  )

  if (issues.length === 0 && waiverNeeded.length === 0) return null

  return (
    <div className="flex items-start gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm">
      <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {issues.length > 0 && (
          <p className="text-amber-800">
            <strong>{issues.length}</strong> selected course{issues.length > 1 ? 's have' : ' has'}
            {' '}unmet requirements:{' '}
            {issues.map((r) => {
              const parts: string[] = []
              if (!r.prereqSatisfied) parts.push(`missing prereq: ${r.prereqMissing.join(', ')}`)
              if (!r.coreqSatisfied) parts.push(`missing coreq: ${r.coreqMissing.join(', ')}`)
              if (r.exclusionConflict) parts.push(`exclusion conflict: ${r.conflictingCourse}`)
              return (
                <span key={r.courseCode} className="font-medium">
                  {r.courseCode}
                </span>
              )
            }).reduce((prev, curr, i) => <>{prev}{i > 0 ? ', ' : ''}{curr}</> as any, null)}
            {' — '}
            <span className="text-amber-700">you may need waivers to enroll.</span>
          </p>
        )}
        {waiverNeeded.length > 0 && (
          <p className="text-blue-700 text-xs mt-0.5">
            Partial confidence for: {waiverNeeded.map((r) => r.courseCode).join(', ')}
            {' — '}verify manually.
          </p>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-0.5 text-amber-400 hover:text-amber-600"
      >
        <X size={14} />
      </button>
    </div>
  )
}
