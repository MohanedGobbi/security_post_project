// Organisation branding (logo, colours, name, login style), chosen when building:
//   VITE_BRAND=ghardaia   or   --mode ghardaia
// Without it, the generic Security Register look is used. One codebase, one build per organisation.
import type { Features, Lang } from '@shared/types'
import ghardaiaLogo from './assets/brands/ghardaia-university.png'
import lawFacultyLogo from './assets/brands/ghardaia-law-faculty.png'

/** replaced at build time by the vite configs (define) */
declare const __BRAND__: string

export interface Brand {
  id: string
  /** the organisation this build is made for; null = generic product */
  org: Record<Lang, string> | null
  /** the program's own name, replacing "Security Register"; null = keep it */
  appName: Record<Lang, string> | null
  /** logo shown instead of the shield (transparent PNG / SVG) */
  logo: string | null
  /** second logo, next to the first on the login page and printed documents (e.g. the university of a faculty) */
  logo2: string | null
  /** overrides of the CSS custom properties in styles.css */
  colors: Record<string, string>
  /** badge header colour */
  badgeColor: string
  /** 'pick': choose your name, then type the PIN. 'pin': the PIN alone says who you are */
  loginMode: 'pick' | 'pin'
  /** language before anyone has chosen one; null = the computer's language */
  defaultLang: Lang | null
  /** the organisation's own feature switches, applied at first setup instead of the profile choice; null = choose a profile */
  features: Features | null
  /** register templates (src/shared/registerTemplates.ts) installed for this organisation when missing */
  registerTemplates: string[]
  /** home screen with the tiles only (no counters, no list of people on site) */
  homeTilesOnly: boolean
  /** registers a team leader fills, in this order, before starting a shift (the paper handover) */
  leaderStartRegisters: string[]
}

const GENERIC: Brand = {
  id: 'default', org: null, appName: null, logo: null, logo2: null, colors: {}, badgeColor: '#0f2a44', loginMode: 'pick', defaultLang: null,
  features: null, registerTemplates: [], homeTilesOnly: false, leaderStartRegisters: []
}

// green and red of the University of Ghardaia logos
const GHARDAIA_COLORS: Record<string, string> = {
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

const GHARDAIA: Brand = {
  ...GENERIC,
  id: 'ghardaia',
  org: { ar: 'جامعة غرداية', en: 'University of Ghardaia', fr: 'Université de Ghardaïa' },
  logo: ghardaiaLogo,
  colors: GHARDAIA_COLORS,
  badgeColor: '#0f4426'
}

// Faculty of Law and Political Science (client's own name for the program, Arabic first, PIN-only login)
const GHARDAIA_LAW: Brand = {
  ...GHARDAIA,
  id: 'ghardaia-law',
  org: {
    ar: 'كلية الحقوق والعلوم السياسية · جامعة غرداية',
    en: 'Faculty of Law and Political Science · University of Ghardaia',
    fr: 'Faculté de droit et des sciences politiques · Université de Ghardaïa'
  },
  appName: { ar: 'برنامج إدارة الأمن بالكلية', en: 'Faculty Security Management', fr: 'Gestion de la sécurité de la faculté' },
  logo: lawFacultyLogo,
  logo2: ghardaiaLogo,
  loginMode: 'pin',
  defaultLang: 'ar',
  // their paper books become registers; incidents, parcels (letters) and keys are registers too
  features: {
    modules: {
      vehicles: false, deliveries: false, incidents: false, patrols: false, keys: false, notes: false,
      watchlist: true, shifts: true, preregistration: false, badges: false
    },
    idScan: true, visitorPhoto: false, requireIdNumber: true, badgeNumbers: false
  },
  registerTemplates: ['shift', 'custody', 'incidents', 'lost_found', 'letters', 'events', 'reports', 'maintenance', 'official_visits', 'evacuation', 'alarms'],
  homeTilesOnly: true,
  leaderStartRegisters: ['shift', 'custody']
}

// compared with literals so the bundler drops the other brands (logo, colours, demo data) from each build
export const BRAND: Brand = __BRAND__ === 'ghardaia' ? GHARDAIA : __BRAND__ === 'ghardaia-law' ? GHARDAIA_LAW : GENERIC

/** Applies the colours, the favicon and the window title; call once before rendering. */
export function applyBrand(): void {
  const root = document.documentElement.style
  for (const [k, v] of Object.entries(BRAND.colors)) root.setProperty(k, v)
  if (BRAND.logo) {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.head.appendChild(document.createElement('link'))
    link.rel = 'icon'
    link.href = BRAND.logo
  }
  if (BRAND.appName) document.title = BRAND.appName[BRAND.defaultLang ?? 'fr']
}

/** Organisation name in the given language, or null for the generic build */
export const orgName = (lang: string): string | null => (BRAND.org ? BRAND.org[lang as Lang] ?? BRAND.org.fr : null)

/** The program's name: the organisation's own one when the brand has it, else the translated "Security Register" */
export const appTitle = (lang: string, t: (k: string) => string): string =>
  BRAND.appName ? BRAND.appName[lang as Lang] ?? BRAND.appName.fr : t('app.title')
