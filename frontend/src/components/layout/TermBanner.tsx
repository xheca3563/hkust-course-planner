import { useAppStore } from '@/stores/appStore'
import { ChevronDown } from 'lucide-react'

export function TermBanner() {
  const terms = useAppStore((s) => s.terms)
  const currentTerm = useAppStore((s) => s.currentTerm)
  const setCurrentTerm = useAppStore((s) => s.setCurrentTerm)

  return (
    <div className="flex items-center justify-between h-8 px-4 bg-[#E8F0F8] border-b border-[#003366]/10 flex-shrink-0">
      {/* Term selector — left */}
      <div className="relative">
        <select
          value={`${currentTerm.year} ${currentTerm.season}`}
          onChange={(e) => {
            const [year, season] = e.target.value.split(' ')
            const term = terms.find((t) => t.year === year && t.season === season)
            if (term) setCurrentTerm(term)
          }}
          className="appearance-none bg-white/60 text-[#003366] text-xs font-semibold
                     pl-2.5 pr-7 py-1 rounded border border-[#003366]/20
                     hover:bg-white transition-colors cursor-pointer
                     focus:outline-none focus:ring-2 focus:ring-[#003366]/30"
        >
          {terms.map((t) => (
            <option key={t.label} value={`${t.year} ${t.season}`}>
              {t.label}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#003366]/60" />
      </div>

      <div className="text-xs text-slate-500">
        Course data as of Aug 2026 · HKUST Course Planner
      </div>
    </div>
  )
}
