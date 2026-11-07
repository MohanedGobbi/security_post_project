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
      vehicles: false, deliveries: false, incidents: true, patrols: false, keys: false, notes: false,
      watchlist: true, shifts: true, preregistration: false, badges: false
    },
    idScan: true, visitorPhoto: false, requireIdNumber: true, badgeNumbers: false
  } as Features,

  /** register templates (registerTemplates.ts) opened at the first start, and again for any added by a later version */
  registerTemplates: ['shift', 'custody', 'incidents', 'lost_found', 'letters', 'events', 'reports', 'maintenance', 'official_visits', 'evacuation', 'alarms', 'student_problems', 'equipment_check'],

  /** the equipment of the security office the list starts with, from their custody book (they add and remove the rest) */
  equipment: [['مفاتيح مكتب الأمن', 1], ['أجهزة الاتصال اللاسلكي', 1], ['أجهزة التفتيش (كشف المعادن)', 1], ['الكاميرات وشاشة المراقبة', 1]] as [string, number][],

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
