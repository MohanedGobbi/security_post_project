// What the program is set up with at its first start, so nobody has to go through a setup screen:
// the faculty's names, the feature switches, the registers and the first two accounts.
import type { Features, Lang, Role } from './types'

export interface FirstAccount { name: string; role: Role; pin: string; language: Lang }

export const FACULTY = {
  /** كلية الحقوق والعلوم السياسية */
  siteName: 'كلية الحقوق والعلوم السياسية',
  /** مكتب الأمن الداخلي للكلية */
  postName: 'مكتب الأمن الداخلي للكلية',

  /** their paper books become registers; incidents, parcels (letters) and keys are registers too */
  features: {
    modules: {
      vehicles: false, deliveries: false, incidents: false, patrols: false, keys: false, notes: false,
      watchlist: true, shifts: true, preregistration: false, badges: false
    },
    idScan: true, visitorPhoto: false, requireIdNumber: true, badgeNumbers: false
  } as Features,

  /** register templates (registerTemplates.ts) opened at the first start, and again for any added by a later version */
  registerTemplates: ['shift', 'custody', 'incidents', 'lost_found', 'letters', 'events', 'reports', 'maintenance', 'official_visits', 'evacuation', 'alarms'],

  /**
   * The first two accounts. The PINs below are only a starting point: the administrator changes them in
   * Administration → Accounts, and a warning stays on that page until they are changed.
   * Guards are added there too.
   */
  accounts: [
    { name: 'مسؤول الأمن', role: 'admin', pin: '246810', language: 'ar' },
    { name: 'رئيس فرقة الأمن', role: 'leader', pin: '135790', language: 'ar' }
  ] as FirstAccount[]
}

/** true when this account still has the PIN it was created with */
export const DEFAULT_PINS: readonly string[] = FACULTY.accounts.map((a) => a.pin)
