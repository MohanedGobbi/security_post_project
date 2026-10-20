// The program is built for one organisation: the Faculty of Law and Political Science, University of Ghardaia.
// Its name, logos, colours and settings live here.
import type { Features, Lang } from '@shared/types'
import { FACULTY } from '@shared/faculty'
import ghardaiaLogo from './assets/brands/ghardaia-university.png'
import lawFacultyLogo from './assets/brands/ghardaia-law-faculty.png'

export interface Brand {
  id: string
  /** the organisation this program is made for */
  org: Record<Lang, string>
  /** the program's own name */
  appName: Record<Lang, string>
  /** faculty logo (transparent PNG) */
  logo: string
  /** the university logo, next to the faculty logo on the login page and printed documents */
  logo2: string
  /** overrides of the CSS custom properties in styles.css */
  colors: Record<string, string>
  /** badge header colour */
  badgeColor: string
  /** language before anyone has chosen one */
  defaultLang: Lang
  /** feature switches applied at first setup (the administrator can change them later) */
  features: Features
  /** home screen with the tiles only (no counters, no list of people on site) */
  homeTilesOnly: boolean
  /** registers a team leader fills, in this order, before starting a shift (the paper handover) */
  leaderStartRegisters: string[]
}

// green and red of the University of Ghardaia logos
const COLORS: Record<string, string> = {
  '--brand': '#0f4426',
  '--brand-line': '#2f6a47',
  '--brand-glow': '#1d6a3c',
  '--brand-link': '#a6e3bb',
  '--brand-stripe': '#d81830',
  '--accent': '#16703a',
  '--accent-hover': '#115a2e',
  '--accent-soft': '#e3f1e7',
  '--accent-ink': '#115a2e',
  '--bg': '#eef2ef'
}

// Faculty of Law and Political Science (client's own name for the program, Arabic first, PIN-only login)
export const BRAND: Brand = {
  id: 'faculty',
  org: {
    ar: 'كلية الحقوق والعلوم السياسية · جامعة غرداية',
    en: 'Faculty of Law and Political Science · University of Ghardaia',
    fr: 'Faculté de droit et des sciences politiques · Université de Ghardaïa'
  },
  appName: { ar: 'برنامج إدارة الأمن بالكلية', en: 'Faculty Security Management', fr: 'Gestion de la sécurité de la faculté' },
  logo: lawFacultyLogo,
  colors: COLORS,
  badgeColor: '#0f4426',
  logo2: ghardaiaLogo,
  defaultLang: 'ar',
  features: FACULTY.features,
  homeTilesOnly: true,
  leaderStartRegisters: ['shift', 'custody']
}

/** Applies the colours, the favicon and the window title; call once before rendering. */
export function applyBrand(): void {
  const root = document.documentElement.style
  for (const [k, v] of Object.entries(BRAND.colors)) root.setProperty(k, v)
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.head.appendChild(document.createElement('link'))
  link.rel = 'icon'
  link.href = BRAND.logo
  document.title = BRAND.appName[BRAND.defaultLang]
}

/** The organisation's name in the given language */
export const orgName = (lang: string): string => BRAND.org[lang as Lang] ?? BRAND.org.ar

/** The program's name in the given language */
export const appTitle = (lang: string): string => BRAND.appName[lang as Lang] ?? BRAND.appName.ar
