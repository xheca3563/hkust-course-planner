import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useAuth } from '@/contexts/AuthContext'
import { Menu, Sparkles, ListChecks, LogOut, User, GraduationCap, Languages } from 'lucide-react'
import { useT, type TKey } from '@/i18n'
import { AuthModal } from '@/components/auth/AuthModal'
import { ProfilePage } from '@/components/profile/ProfilePage'
import type { AppMode } from '@/types'

const modeOptions: { mode: AppMode; labelKey: TKey; icon: typeof ListChecks }[] = [
  { mode: 'manual', labelKey: 'header.modeManual', icon: ListChecks },
  { mode: 'smart', labelKey: 'header.modeSmart', icon: Sparkles },
]

export function Header() {
  const t = useT()
  const mode = useAppStore((s) => s.mode)
  const setMode = useAppStore((s) => s.setMode)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const language = useAppStore((s) => s.language)
  const setLanguage = useAppStore((s) => s.setLanguage)
  const { user, signOut } = useAuth()
  const syncToCloud = useAppStore((s) => s.syncToCloud)
  const clearUserData = useAppStore((s) => s.clearUserData)
  const refreshPrereqStatus = useAppStore((s) => s.refreshPrereqStatus)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const handleProfileOpen = () => {
    if (!user) {
      setShowAuthModal(true)
      return
    }
    setShowProfile(true)
  }

  return (
    <>
      <header className="flex items-center justify-between h-12 px-4 bg-[#003366] text-white flex-shrink-0 shadow-md z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-white/15 transition-colors"
            title={t('header.toggleSidebar')}
          >
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <img src="/icon.png" alt="CoursePlanner" className="h-9 w-auto" />
            CoursePlanner
          </h1>
          <button
            onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors"
            title="Language / 语言"
          >
            <Languages size={14} />
            {language === 'en' ? '中文' : 'EN'}
          </button>
        </div>

        {/* Mode buttons + Progress nav — centered */}
        <nav className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
            {modeOptions.map(({ mode: m, labelKey, icon: Icon }) => (
              <button
                key={m}
                onClick={() => { setMode(m); setView('planner') }}
                className={`
                  flex items-center gap-1.5 px-5 py-1.5 rounded-md text-sm font-medium
                  transition-all duration-200
                  ${mode === m && view === 'planner'
                    ? 'bg-white text-[#003366] shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                  }
                `}
              >
                <Icon size={16} />
                {t(labelKey)}
              </button>
            ))}
          </div>

          {/* Progress tracker nav button */}
          <button
            onClick={() => {
              setView('progress')
              refreshPrereqStatus()
            }}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
              transition-all duration-200
              ${view === 'progress'
                ? 'bg-white text-[#003366] shadow-sm'
                : 'text-white/80 hover:text-white hover:bg-white/10'
              }
            `}
            title={t('header.progress')}
          >
            <GraduationCap size={16} />
            {t('header.progress')}
          </button>
        </nav>

        {/* Auth area */}
        <div className="w-[160px] flex justify-end items-center gap-2">
          {user ? (
            <>
              <button
                onClick={handleProfileOpen}
                className="p-1.5 rounded-md hover:bg-white/15 transition-colors"
                title={t('header.profile')}
              >
                <User size={18} />
              </button>
              <span className="text-xs text-white/70 truncate max-w-[80px]" title={user.email}>
                {user.email?.split('@')[0]}
              </span>
              <button
                onClick={async () => { await syncToCloud(); clearUserData(); await signOut(); }}
                className="text-sm text-white/70 hover:text-white transition-colors px-2 py-1.5 rounded-md hover:bg-white/10"
                title={t('header.logout')}
              >
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-sm text-white/80 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/10"
            >
              {t('header.login')}
            </button>
          )}
        </div>
      </header>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      {showProfile && <ProfilePage onClose={() => setShowProfile(false)} />}
    </>
  )
}
