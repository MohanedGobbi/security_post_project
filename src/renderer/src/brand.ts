// Organisation branding (logo, colours, name), chosen when building:
//   VITE_BRAND=ghardaia   or   --mode ghardaia
// Without it, the generic Security Register look is used. One codebase, one build per organisation.
import type { Lang } from '@shared/types'
import ghardaiaLogo from './assets/brands/ghardaia.png'

/** replaced at build time by the vite configs (define) */
declare const __BRAND__: string

export interface Brand {
  id: string
  /** the organisation this build is made for; null = generic product */
  org: Record<Lang, string> | null
  /** logo shown instead of the shield (transparent PNG / SVG) */
  logo: string | null
  /** overrides of the CSS custom properties in styles.css */
  colors: Record<string, string>
  /** badge header colour */
  badgeColor: string
}

const GENERIC: Brand = { id: 'default', org: null, logo: null, colors: {}, badgeColor: '#0f2a44' }

const GHARDAIA: Brand = {
  id: 'ghardaia',
  org: { ar: 'جامعة غرداية', en: 'University of Ghardaia', fr: 'Université de Ghardaïa' },
  logo: ghardaiaLogo,
  // green and red of the university logo
  colors: {
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
  },
  badgeColor: '#0f4426'
}

// compared with literals so the bundler drops the other brands (logo, colours, demo data) from each build
export const BRAND: Brand = __BRAND__ === 'ghardaia' ? GHARDAIA : GENERIC

/** Applies the colours and the favicon; call once before rendering. */
export function applyBrand(): void {
  const root = document.documentElement.style
  for (const [k, v] of Object.entries(BRAND.colors)) root.setProperty(k, v)
  if (BRAND.logo) {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.head.appendChild(document.createElement('link'))
    link.rel = 'icon'
    link.href = BRAND.logo
  }
}

/** Organisation name in the given language, or null for the generic build */
export const orgName = (lang: string): string | null => (BRAND.org ? BRAND.org[lang as Lang] ?? BRAND.org.fr : null)
