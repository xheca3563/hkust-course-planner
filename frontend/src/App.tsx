import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useAuth } from '@/contexts/AuthContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { CourseDetailPanel } from '@/components/course/CourseDetailPanel'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { TimetableView } from '@/components/timetable/TimetableView'
import { SmartPanel } from '@/components/scheduler/SmartPanel'
import { StatusBar } from '@/components/layout/StatusBar'
import { TermBanner } from '@/components/layout/TermBanner'
import { PrereqSummaryBar } from '@/components/progress/PrereqSummaryBar'
import { ProgressTracker } from '@/components/progress/ProgressTracker'

function AppContent() {
  const mode = useAppStore((s) => s.mode)
  const view = useAppStore((s) => s.view)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const detailCourse = useAppStore((s) => s.detailCourse)
  const loadFromCloud = useAppStore((s) => s.loadFromCloud)
  const syncToCloud = useAppStore((s) => s.syncToCloud)
  const refreshPrereqStatus = useAppStore((s) => s.refreshPrereqStatus)
  const selectedCourses = useAppStore((s) => s.selectedCourses)
  const profile = useAppStore((s) => s.profile)
  const { user } = useAuth()
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load cloud data when user logs in
  useEffect(() => {
    if (user) {
      loadFromCloud()
    }
  }, [user, loadFromCloud])

  // Refresh prerequisite status whenever selected courses or completed courses change
  useEffect(() => {
    if (user && (selectedCourses.length > 0 || profile.completedCourses.length > 0)) {
      const timer = setTimeout(() => refreshPrereqStatus(), 500)
      return () => clearTimeout(timer)
    }
  }, [user, selectedCourses.length, profile.completedCourses.length, refreshPrereqStatus])

  // Auto-sync to cloud when data changes (debounced, while logged in)
  useEffect(() => {
    if (!user) return

    // Zustand v5 subscribe: fires on every state change; debounce to avoid
    // excessive cloud writes. We compare JSON strings of data slices to
    // avoid syncing when only UI state (sidebar, etc.) changes.
    let prev = ''
    const unsub = useAppStore.subscribe((state) => {
      const snap = JSON.stringify({
        courses: state.selectedCourses,
        selections: state.manualSelections,
        results: state.scheduleResults,
        favorites: state.favorites,
        constraints: state.constraints,
        profile: state.profile,
      })
      if (snap === prev) return // no data change, skip
      prev = snap

      if (syncTimer.current) clearTimeout(syncTimer.current)
      syncTimer.current = setTimeout(() => {
        syncToCloud()
      }, 3000)
    })

    return () => {
      unsub()
      if (syncTimer.current) clearTimeout(syncTimer.current)
    }
  }, [user, syncToCloud])

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Header />
      <TermBanner />

      {/* Prerequisite warning banner */}
      {view === 'planner' && <PrereqSummaryBar />}

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`
            flex-shrink-0 border-r border-slate-200 bg-white
            transition-all duration-300 ease-in-out overflow-hidden
            ${sidebarOpen ? 'w-[280px]' : 'w-0'}
          `}
        >
          <div className="w-[280px] h-full">
            <Sidebar />
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-3">
            {view === 'progress' ? (
              <ProgressTracker />
            ) : mode === 'manual' ? (
              <TimetableView />
            ) : (
              <SmartPanel />
            )}
          </div>
          <StatusBar />
        </main>
      </div>

      {/* Course detail modal */}
      {detailCourse && <CourseDetailPanel />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
