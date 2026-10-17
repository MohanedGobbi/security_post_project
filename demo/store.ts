// Demo data shared by the reception app and the dashboard demos.
// Everything lives in this browser (localStorage); photos only in memory.
import type {
  BadgeSettings, Checkpoint, CheckStatus, CustomField, CustomValues, ExpectedVisitor, Features, IdType, IncidentType, KeyKind,
  Lang, NoteCategory, Role, Settings, Severity, VehicleType, WatchLevel
} from '@shared/types'
import { PROFILES } from '@shared/features'

export interface DUser { id: number; name: string; role: Role; pin: string; language: Lang; active: boolean }
export interface DVisit {
  id: number; fullName: string; fullNameAlt: string; idType: IdType; idNumber: string; nationality: string; birthDate: string; sex: string
  phone: string; company: string; host: string; purpose: string; badgeNo: string; vehiclePlate: string; notes: string
  timeIn: string; timeOut: string | null; guardIn: string; guardOut: string | null; custom: CustomValues; hasPhoto: boolean
}
export interface DNote { id: number; time: string; category: NoteCategory; text: string; guard: string }
export interface DVehicle {
  id: number; plate: string; vehicleType: VehicleType; color: string; driverName: string; company: string; passengers: number; cargo: string
  notes: string; visitId: number | null; timeIn: string; timeOut: string | null; guardIn: string; guardOut: string | null; custom: CustomValues; hasPhoto: boolean
}
export interface DDelivery {
  id: number; time: string; carrier: string; courierName: string; recipient: string; parcels: number; tracking: string; notes: string
  guard: string; pickedUpAt: string | null; pickedUpBy: string; guardPickup: string | null; custom: CustomValues; hasPhoto: boolean
}
export interface DIncident {
  id: number; type: IncidentType; severity: Severity; occurredAt: string; createdAt: string; location: string; description: string
  peopleInvolved: string; actionTaken: string; guard: string; closedAt: string | null; closedBy: string | null; resolution: string; photoCount: number
}
export interface DShift { id: number; userId: number; guard: string; post: string; startedAt: string; endedAt: string | null; handoverNote: string; acknowledgedBy: string | null }
export interface DRound {
  id: number; guardId: number; guard: string; startedAt: string; endedAt: string | null; note: string
  checks: { checkpointId: number; time: string; status: CheckStatus; note: string; method: 'manual' | 'qr' }[]
}
export interface DKeyItem { id: number; label: string; kind: KeyKind; code: string; location: string; active: boolean }
export interface DLoan {
  id: number; itemId: number; borrower: string; borrowerInfo: string; outAt: string; dueAt: string | null; returnedAt: string | null
  guardOut: string; guardIn: string | null; notes: string
}
export interface DWatch {
  id: number; name: string; idNumber: string; plate: string; reason: string; level: WatchLevel; active: boolean; addedBy: string; createdAt: string
  /** true = created in the dashboard (organisation list) */
  org: boolean
}
export interface DExpected extends ExpectedVisitor { siteId: number; createdBy: string; email: string; createdAt: string }
export interface DDashUser { id: number; email: string; name: string; role: 'owner' | 'supervisor' | 'host'; password: string; language: Lang; active: boolean; siteIds: number[] | null; createdAt: string }
export interface DSite { id: number; name: string; address: string; active: boolean }
export interface DDevice { id: number; siteId: number; name: string; lastSeen: string | null; revoked: boolean; appVersion: string; createdAt: string }
/** visit / vehicle / incident… of the other demo sites, already in the shape the dashboard expects */
export interface DOtherRecord { entity: string; localId: number; siteId: number; device: string; time: string; data: Record<string, unknown> }

export interface DemoStore {
  version: number
  settings: Settings
  features: Features
  badge: BadgeSettings
  users: DUser[]
  currentUserId: number | null
  visits: DVisit[]
  notes: DNote[]
  vehicles: DVehicle[]
  deliveries: DDelivery[]
  incidents: DIncident[]
  shifts: DShift[]
  checkpoints: Checkpoint[]
  rounds: DRound[]
  keyItems: DKeyItem[]
  loans: DLoan[]
  watch: DWatch[]
  customFields: CustomField[]
  expected: DExpected[]
  sync: { configured: boolean; deviceName: string; lastSync: string | null }
  // dashboard side
  dashUsers: DDashUser[]
  dashUserId: number | null
  sites: DSite[]
  devices: DDevice[]
  other: DOtherRecord[]
  retentionDays: number
  seq: number
}

const KEY = 'secreg-demo-v1'
const VERSION = 1

const iso = (msAgo: number): string => new Date(Date.now() - msAgo).toISOString()
const H = 3600000
const M = 60000
const dayStr = (offsetDays = 0): string => {
  const d = new Date(Date.now() + offsetDays * 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function seed(): DemoStore {
  const v = (id: number, fullName: string, company: string, host: string, purpose: string, inAgo: number, outAgo: number | null, extra: Partial<DVisit> = {}): DVisit => ({
    id, fullName, fullNameAlt: '', idType: 'national_id', idNumber: String(10000000 + id * 7919), nationality: 'TUN', birthDate: '', sex: '', phone: '',
    company, host, purpose, badgeNo: `V-${id}`, vehiclePlate: '', notes: '', timeIn: iso(inAgo), timeOut: outAgo === null ? null : iso(outAgo),
    guardIn: id % 2 ? 'Sonia' : 'Admin', guardOut: outAgo === null ? null : 'Sonia', custom: {}, hasPhoto: false, ...extra
  })
  const other = (): DOtherRecord[] => {
    const out: DOtherRecord[] = []
    const people = [['Amine Jaziri', 'Tunisie Telecom', 'Production'], ['Rania Ben Salem', 'Bureau Veritas', 'Qualité'], ['Hichem Trabelsi', 'STEG', 'Maintenance'],
      ['Ines Mabrouk', '', 'RH'], ['Walid Chaabane', 'DHL', 'Logistique'], ['Sarra Gharbi', 'Deloitte', 'Direction'], ['Nizar Ayari', '', 'Comptabilité']]
    people.forEach(([name, company, host], i) => {
      const site = i % 2 ? 3 : 2
      const inAgo = (i + 1) * 47 * M
      out.push({ entity: 'visit', localId: i + 1, siteId: site, device: site === 2 ? 'Portail usine' : 'Accueil siège', time: iso(inAgo), data: {
        fullName: name, fullNameAlt: '', idType: 'national_id', idMasked: `••••${(4321 + i * 37) % 10000}`, company, host, purpose: 'Réunion', badgeNo: `B-${i + 1}`,
        vehiclePlate: '', notes: '', timeIn: iso(inAgo), timeOut: i < 3 ? null : iso(inAgo - 35 * M), guardIn: 'Karim', guardOut: i < 3 ? null : 'Karim', custom: []
      } })
    })
    out.push({ entity: 'vehicle', localId: 1, siteId: 2, device: 'Portail usine', time: iso(2 * H), data: {
      plate: '182 TU 4471', vehicleType: 'truck', color: 'Blanc', driverName: 'Lassaad', company: 'Transport Sahel', passengers: 1, cargo: 'Matières premières',
      notes: '', timeIn: iso(2 * H), timeOut: null, guardIn: 'Karim', guardOut: null, custom: [] } })
    out.push({ entity: 'incident', localId: 1, siteId: 3, device: 'Accueil siège', time: iso(5 * H), data: {
      type: 'fire_alarm', severity: 'medium', occurredAt: iso(5 * H), location: 'Étage 3', description: 'Alarme incendie déclenchée par de la fumée de cuisine.',
      peopleInvolved: '', actionTaken: 'Vérification, réarmement', guard: 'Leila', closedAt: iso(4 * H), closedBy: 'Leila', resolution: 'Fausse alerte', photoCount: 0 } })
    return out
  }

  return {
    version: VERSION,
    settings: { siteName: 'Université de Tunis — démo', postName: 'Entrée principale', retentionDays: 365, overstayHours: 8, closingTime: '', vehicleOverstayHours: 0, patrolIntervalHours: 4 },
    features: PROFILES.large,
    badge: { printer: '', size: 'cr80', autoPrint: false, showPhoto: true },
    users: [
      { id: 1, name: 'Admin', role: 'admin', pin: '1234', language: 'fr', active: true },
      { id: 2, name: 'Sonia', role: 'guard', pin: '5678', language: 'ar', active: true }
    ],
    currentUserId: null,
    visits: [
      v(1, 'Leila Mansour', 'ACME Tunisie', 'Labo de chimie', 'Réunion', 9.5 * H, null, { fullNameAlt: 'ليلى منصور', vehiclePlate: '245 TU 1888' }),
      v(2, 'Youssef Hammami', 'Ooredoo', 'Service Achats', 'Réunion fournisseur', 70 * M, null),
      v(3, 'Nadia Karoui', 'Orange', 'Service IT', 'Maintenance réseau', 25 * M, null),
      v(4, 'Mehdi Bouazizi', 'Poste Tunisienne', 'Courrier', 'Livraison', 5 * H, 4.6 * H),
      v(5, 'Amel Sassi', '', 'Scolarité', 'Inscription', 4 * H, 3.2 * H),
      v(6, 'Fares Dridi', 'Cabinet Dridi', 'Direction', 'Rendez-vous', 3 * H, 2.1 * H),
      v(7, 'Olfa Ben Amor', '', 'Bibliothèque', 'Visite', 26 * H, 24 * H)
    ],
    notes: [
      { id: 1, time: iso(3.5 * H), category: 'patrol', text: 'Ronde de 8h : parking et bâtiment C vérifiés, RAS.', guard: 'Sonia' },
      { id: 2, time: iso(2.2 * H), category: 'maintenance', text: 'Éclairage du parking sud en panne, signalé au service technique.', guard: 'Sonia' },
      { id: 3, time: iso(40 * M), category: 'general', text: 'Livraison de matériel informatique attendue cet après-midi.', guard: 'Admin' }
    ],
    vehicles: [
      { id: 1, plate: '245 TU 1888', vehicleType: 'car', color: 'Gris', driverName: 'Leila Mansour', company: 'ACME Tunisie', passengers: 0, cargo: '', notes: '', visitId: 1,
        timeIn: iso(9.5 * H), timeOut: null, guardIn: 'Sonia', guardOut: null, custom: {}, hasPhoto: false },
      { id: 2, plate: '118 TU 5555', vehicleType: 'van', color: 'Blanc', driverName: 'Sami', company: 'Aramex', passengers: 1, cargo: 'Colis', notes: '', visitId: null,
        timeIn: iso(15 * M), timeOut: null, guardIn: 'Admin', guardOut: null, custom: {}, hasPhoto: false }
    ],
    deliveries: [
      { id: 1, time: iso(2 * H), carrier: 'Aramex', courierName: 'Sami', recipient: 'Service informatique', parcels: 3, tracking: 'ARX-55102', notes: '', guard: 'Sonia',
        pickedUpAt: null, pickedUpBy: '', guardPickup: null, custom: {}, hasPhoto: false },
      { id: 2, time: iso(50 * M), carrier: 'Rapid Poste', courierName: '', recipient: 'قسم المحاسبة', parcels: 1, tracking: '', notes: '', guard: 'Admin',
        pickedUpAt: null, pickedUpBy: '', guardPickup: null, custom: {}, hasPhoto: false },
      { id: 3, time: iso(6 * H), carrier: 'DHL', courierName: '', recipient: 'Direction', parcels: 1, tracking: 'DHL-889', notes: '', guard: 'Sonia',
        pickedUpAt: iso(5 * H), pickedUpBy: 'Mme Gharbi', guardPickup: 'Sonia', custom: {}, hasPhoto: false }
    ],
    incidents: [
      { id: 1, type: 'suspicious', severity: 'medium', occurredAt: iso(80 * M), createdAt: iso(78 * M), location: 'Parking nord', description: 'Personne qui fait le tour des voitures, partie à l’arrivée de l’agent.',
        peopleInvolved: 'Homme, veste noire', actionTaken: 'Ronde renforcée sur le parking', guard: 'Sonia', closedAt: null, closedBy: null, resolution: '', photoCount: 0 },
      { id: 2, type: 'lost_found', severity: 'low', occurredAt: iso(27 * H), createdAt: iso(27 * H), location: 'Amphi B', description: 'Portefeuille trouvé.',
        peopleInvolved: '', actionTaken: 'Gardé au poste', guard: 'Admin', closedAt: iso(25 * H), closedBy: 'Admin', resolution: 'Rendu au propriétaire (étudiant)', photoCount: 0 }
    ],
    shifts: [
      { id: 1, userId: 2, guard: 'Sonia', post: 'Entrée principale', startedAt: iso(12 * H), endedAt: iso(10 * M),
        handoverNote: 'Leila Mansour (ACME) est encore au labo de chimie depuis ce matin. 3 colis pour le service informatique en attente. Personne suspecte vue au parking nord : incident ouvert.',
        acknowledgedBy: null }
    ],
    checkpoints: [
      { id: 1, name: 'Bâtiment A', location: 'Porte principale', code: 'A1B2C3D4', active: true },
      { id: 2, name: 'Parking nord', location: 'Barrière', code: 'E5F6G7H8', active: true },
      { id: 3, name: 'Laboratoire', location: '2e étage, couloir B', code: 'J9K2L3M4', active: true },
      { id: 4, name: 'Bibliothèque', location: 'Issue de secours', code: 'N5P6Q7R8', active: true }
    ],
    rounds: [
      { id: 1, guardId: 2, guard: 'Sonia', startedAt: iso(5 * H), endedAt: iso(4.6 * H), note: 'RAS',
        checks: [1, 2, 3, 4].map((c, i) => ({ checkpointId: c, time: iso(5 * H - i * 5 * M), status: 'ok' as CheckStatus, note: '', method: (i % 2 ? 'qr' : 'manual') as 'qr' | 'manual' })) }
    ],
    keyItems: [
      { id: 1, label: 'Clé salle serveurs', kind: 'key', code: 'K-01', location: 'Armoire 1', active: true },
      { id: 2, label: 'Talkie-walkie 1', kind: 'radio', code: 'R-1', location: 'Chargeur', active: true },
      { id: 3, label: 'Badge visiteur VIP', kind: 'badge', code: 'B-VIP', location: 'Tiroir', active: true },
      { id: 4, label: 'Clé amphi B', kind: 'key', code: 'K-07', location: 'Armoire 2', active: true }
    ],
    loans: [
      { id: 1, itemId: 1, borrower: 'Technicien Orange', borrowerInfo: 'Nadia Karoui', outAt: iso(20 * M), dueAt: iso(-60 * M), returnedAt: null, guardOut: 'Admin', guardIn: null, notes: '' },
      { id: 2, itemId: 4, borrower: 'Pr. Ben Ali', borrowerInfo: 'Département physique', outAt: iso(3 * H), dueAt: iso(30 * M), returnedAt: null, guardOut: 'Sonia', guardIn: null, notes: '' }
    ],
    watch: [
      { id: 1, name: 'Karim Ben Youssef', idNumber: '09876543', plate: '', reason: 'Vol de matériel informatique en mars', level: 'deny', active: true, addedBy: 'Direction', createdAt: iso(30 * 24 * H), org: true }
    ],
    customFields: [
      { id: 1, entity: 'visit', labels: { ar: 'نوع الشارة', en: 'Badge type', fr: 'Type de badge' }, type: 'select', options: ['Visiteur', 'Prestataire', 'VIP'], required: false, active: true }
    ],
    expected: [
      { id: 1, refCode: 'ZX2SP6', fullName: 'Karima Jlassi', company: 'Ernst & Young', host: 'Direction', purpose: 'Audit', phone: '', validFrom: dayStr(), validTo: dayStr(),
        notes: '', status: 'pending', source: 'server', arrivedAt: null, visitId: null, siteId: 1, createdBy: 'Mouna (Direction)', email: '', createdAt: iso(26 * H) },
      { id: 2, refCode: 'QM7TA4', fullName: 'Slim Haddad', company: 'Huawei', host: 'Service IT', purpose: 'Installation', phone: '', validFrom: dayStr(), validTo: dayStr(1),
        notes: 'Apporte du matériel', status: 'pending', source: 'local', arrivedAt: null, visitId: null, siteId: 1, createdBy: 'Admin', email: '', createdAt: iso(3 * H) },
      { id: 3, refCode: 'HT3PB9', fullName: 'Dr. Samia Ferchichi', company: 'Ministère', host: 'Présidence', purpose: 'Visite officielle', phone: '', validFrom: dayStr(1), validTo: dayStr(1),
        notes: '', status: 'pending', source: 'server', arrivedAt: null, visitId: null, siteId: 1, createdBy: 'Mouna (Direction)', email: '', createdAt: iso(5 * H) }
    ],
    sync: { configured: true, deviceName: 'Entrée principale', lastSync: iso(30000) },
    dashUsers: [
      { id: 1, email: 'demo@security-register.app', name: 'Mouna (Direction)', role: 'owner', password: 'demo1234', language: 'fr', active: true, siteIds: null, createdAt: iso(60 * 24 * H) },
      { id: 2, email: 'it@security-register.app', name: 'Ahmed (IT)', role: 'host', password: 'demo1234', language: 'fr', active: true, siteIds: [1], createdAt: iso(20 * 24 * H) }
    ],
    dashUserId: null,
    sites: [
      { id: 1, name: 'Université de Tunis — démo', address: 'Campus universitaire', active: true },
      { id: 2, name: 'Usine Sfax', address: 'Route de Gabès', active: true },
      { id: 3, name: 'Siège Tunis', address: 'Les Berges du Lac', active: true }
    ],
    devices: [
      { id: 1, siteId: 1, name: 'Entrée principale', lastSeen: iso(30000), revoked: false, appVersion: '0.1.0', createdAt: iso(30 * 24 * H) },
      { id: 2, siteId: 2, name: 'Portail usine', lastSeen: iso(45000), revoked: false, appVersion: '0.1.0', createdAt: iso(30 * 24 * H) },
      { id: 3, siteId: 3, name: 'Accueil siège', lastSeen: iso(3 * H), revoked: false, appVersion: '0.1.0', createdAt: iso(30 * 24 * H) }
    ],
    other: other(),
    retentionDays: 365,
    seq: 1000
  }
}

let store: DemoStore | null = null

/** Photos are not persisted (localStorage is small) */
export const photos = new Map<string, Uint8Array[]>()

export function db(): DemoStore {
  if (store) return store
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as DemoStore) : null
    store = parsed && parsed.version === VERSION ? parsed : seed()
  } catch {
    store = seed()
  }
  return store
}

/** Saves after every change; another tab (dashboard ↔ reception) picks it up on its next read */
export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db()))
  } catch {
    // private mode / storage full: the demo keeps working in memory
  }
}

/** Reload from storage (changes made in the other demo tab) */
export function refresh(): void {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) store = JSON.parse(raw) as DemoStore
  } catch {
    // keep the in-memory copy
  }
}

export function resetDemo(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
  store = seed()
  save()
}

export const nextId = (): number => {
  const s = db()
  s.seq += 1
  return s.seq
}

export const nowIso = (): string => new Date().toISOString()
export const today = (): string => dayStr()
export const dayBounds = (from: string, to: string): [string, string] =>
  [new Date(`${from}T00:00:00`).toISOString(), new Date(`${to}T23:59:59.999`).toISOString()]

/** Simulated network delay so the demo feels like the real app */
export const wait = (ms = 120): Promise<void> => new Promise((r) => setTimeout(r, ms))

export class DemoError extends Error {}
export const fail = (key: string): never => {
  throw new DemoError(key)
}
