/* Translation dictionaries + pure translate() — no store imports here
 * (the store also uses translate(), so keep this module cycle-free). */
import type { Language } from '@/types'
import { header } from './translations/header'
import { auth } from './translations/auth'
import { layout } from './translations/layout'
import { course } from './translations/course'
import { constraints } from './translations/constraints'
import { timetable } from './translations/timetable'
import { scheduler } from './translations/scheduler'
import { profile } from './translations/profile'
import { progress } from './translations/progress'

export const translations = {
  ...header,
  ...auth,
  ...layout,
  ...course,
  ...constraints,
  ...timetable,
  ...scheduler,
  ...profile,
  ...progress,
} as const

export type TKey = keyof typeof translations

export type TVars = Record<string, string | number | null | undefined>

export function translate(key: TKey, lang: Language, vars?: TVars): string {
  const entry = translations[key]
  if (!entry) return String(key)
  let s: string = entry[lang] ?? entry.en
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, v === null || v === undefined ? '' : String(v))
    }
  }
  return s
}
