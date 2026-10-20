import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { isRtl, LANGS, resources } from '@shared/i18n'
import type { Lang } from '@shared/types'
import { BRAND } from './brand'

const STORAGE_KEY = 'lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null
    if (saved && LANGS.includes(saved)) return saved
  } catch {
    // storage unavailable
  }
  // an organisation's build can start in its own language (e.g. Arabic for the faculty)
  if (BRAND.defaultLang) return BRAND.defaultLang
  const nav = navigator.language.slice(0, 2) as Lang
  return LANGS.includes(nav) ? nav : 'en'
}

function applyDir(lang: string): void {
  document.documentElement.lang = lang
  document.documentElement.dir = isRtl(lang as Lang) ? 'rtl' : 'ltr'
}

i18n.use(initReactI18next).init({
  resources: { ar: { translation: resources.ar }, en: { translation: resources.en }, fr: { translation: resources.fr } },
  lng: initialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
})

applyDir(i18n.language)
i18n.on('languageChanged', (lang) => {
  applyDir(lang)
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // storage unavailable
  }
})

export const currentLang = (): Lang => i18n.language as Lang

export default i18n
