import ar from './locales/ar.json'
import en from './locales/en.json'
import fr from './locales/fr.json'
import type { CustomField, Lang } from './types'

export const resources = { ar, en, fr } as const
export const LANGS: Lang[] = ['ar', 'en', 'fr']

/** Locale tags used for dates and numbers. Arabic keeps Western digits (common in the Maghreb). */
export const LOCALE_TAG: Record<Lang, string> = { ar: 'ar-u-nu-latn', en: 'en-GB', fr: 'fr-FR' }

export const isRtl = (lang: Lang): boolean => lang === 'ar'

/** Custom field label in the wanted language, else the first one filled in */
export const fieldLabel = (f: Pick<CustomField, 'labels'>, lang: Lang): string => f.labels[lang] || f.labels.en || f.labels.fr || f.labels.ar

/** Display value of a custom field (yes/no and dates are translated / formatted) */
export function fieldValue(f: Pick<CustomField, 'type'>, value: string | undefined, lang: Lang): string {
  if (!value) return ''
  if (f.type === 'yesno') return translate(lang, value === 'yes' ? 'common.yes' : 'common.no')
  if (f.type === 'date') return new Date(`${value}T12:00:00`).toLocaleDateString(LOCALE_TAG[lang])
  return value
}

/** Minimal translator for the main process (the UI uses i18next with the same files). */
export function translate(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const lookup = (l: Lang): unknown => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], resources[l])
  const value = lookup(lang) ?? lookup('en')
  const text = typeof value === 'string' ? value : key
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ''))
}

export function formatDateTime(iso: string | null, lang: Lang): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(LOCALE_TAG[lang], { dateStyle: 'short', timeStyle: 'short' })
}

export function formatTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(LOCALE_TAG[lang], { hour: '2-digit', minute: '2-digit' })
}

export function formatDuration(fromIso: string, toIso: string | null, lang: Lang): string {
  const mins = Math.max(0, Math.round(((toIso ? new Date(toIso) : new Date()).getTime() - new Date(fromIso).getTime()) / 60000))
  if (mins < 60) return translate(lang, 'common.minutes', { count: mins })
  return translate(lang, 'common.hours', { h: Math.floor(mins / 60), m: mins % 60 })
}
