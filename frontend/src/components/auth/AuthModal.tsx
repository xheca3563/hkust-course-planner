import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/i18n'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function AuthModal({ isOpen, onClose }: Props) {
  const t = useT()
  const { signIn, signUp } = useAuth()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email.trim() || !password) {
      setError(t('auth.fillAllFields'))
      return
    }

    if (password.length < 6) {
      setError(t('auth.passwordMinLength'))
      return
    }

    if (tab === 'register' && password !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }

    setIsSubmitting(true)
    try {
      if (tab === 'login') {
        const result = await signIn(email, password)
        if (result.error) {
          setError(result.error === 'Invalid login credentials'
            ? t('auth.invalidCredentials')
            : result.error)
        } else {
          onClose()
        }
      } else {
        const result = await signUp(email, password)
        if (result.error) {
          if (result.error.includes('already registered')) {
            setError(t('auth.emailAlreadyRegistered'))
          } else {
            setError(result.error)
          }
        } else {
          setSuccess(t('auth.signupSuccess'))
        }
      }
    } catch {
      setError(t('auth.operationFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchTab = (t: 'login' | 'register') => {
    setTab(t)
    setError('')
    setSuccess('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex gap-3">
            <button
              onClick={() => switchTab('login')}
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${
                tab === 'login'
                  ? 'text-[#003366] border-[#003366]'
                  : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}
            >
              {t('auth.login')}
            </button>
            <button
              onClick={() => switchTab('register')}
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${
                tab === 'register'
                  ? 'text-[#003366] border-[#003366]'
                  : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}
            >
              {t('auth.register')}
            </button>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              {success}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('auth.emailLabel')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]
                         placeholder:text-slate-400"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('auth.passwordLabel')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]
                         placeholder:text-slate-400"
            />
          </div>

          {tab === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {t('auth.confirmPassword')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]
                           placeholder:text-slate-400"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${
              isSubmitting
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-[#003366] hover:bg-[#002244]'
            }`}
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin inline mr-1" />
            ) : null}
            {tab === 'login' ? t('auth.login') : t('auth.register')}
          </button>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400">
            {t('auth.syncHint')}
          </p>
        </div>
      </div>
    </div>
  )
}
