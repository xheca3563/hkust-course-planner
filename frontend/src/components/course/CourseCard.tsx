import { Plus, Minus, Star } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { PrereqWarningBadge } from '@/components/course/PrereqWarning'
import { useT } from '@/i18n'
import type { Course } from '@/types'

interface CourseCardProps {
  course: Course
  isSelected: boolean
  onAdd: () => void
  onRemove: () => void
}

export function CourseCard({ course, isSelected, onAdd, onRemove }: CourseCardProps) {
  const t = useT()
  const openDetail = useAppStore((s) => s.openDetail)

  return (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer
        ${
          isSelected
            ? 'border-[#003366] bg-[#E8F0F8] shadow-sm'
            : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
        }
      `}
    >
      {/* Course code badge */}
      <div className="flex-shrink-0 text-center" style={{ width: 56 }}>
        <span className="text-[10px] text-slate-400 block leading-tight">{course.school}</span>
        <span className="text-[10px] text-slate-500 block leading-tight">{course.department}</span>
        <span className="text-xs font-bold text-[#003366]">{course.code.split(' ')[1]}</span>
      </div>

      {/* Course info - click to detail */}
      <div
        className="flex-1 min-w-0"
        onClick={() => openDetail(course)}
        title={t('course.clickForDetails')}
      >
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-slate-800 leading-tight hover:text-[#003366] transition-colors">
            {course.title}
          </p>
          <PrereqWarningBadge courseCode={course.code} />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-slate-500">{t('course.creditsShort', { n: course.credits })}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {course.school}-{course.department}
          </span>
          {course.rating && (
            <span className="flex items-center gap-0.5 text-xs text-amber-500">
              <Star size={10} fill="currentColor" />
              {course.rating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400">
          <span>{t('course.lectureCount', { n: course.sections.filter(s => s.sectionType === 'L').length })}</span>
          <span>·</span>
          <span>{t('course.sectionCountTotal', { n: course.sections.length })}</span>
        </div>
      </div>

      {/* Add/Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          isSelected ? onRemove() : onAdd()
        }}
        className={`
          flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
          transition-all
          ${
            isSelected
              ? 'bg-red-100 text-red-500 hover:bg-red-200'
              : 'bg-[#003366]/10 text-[#003366] hover:bg-[#003366] hover:text-white'
          }
        `}
      >
        {isSelected ? <Minus size={14} /> : <Plus size={14} />}
      </button>
    </div>
  )
}
