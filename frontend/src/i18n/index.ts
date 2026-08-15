/* Lightweight i18n entry: re-exports the dictionaries and provides the
 * React hook. Default language is English; the user can switch via the
 * header toggle (persisted to localStorage). */
import { useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { translate, type TKey, type TVars } from './dict'

export { translations, translate, type TKey, type TVars } from './dict'

/** React hook: returns a t() bound to the current store language. */
export function useT() {
  const lang = useAppStore((s) => s.language)
  return useCallback((key: TKey, vars?: TVars) => translate(key, lang, vars), [lang])
}
