// Demo data of the web demo (kept in the browser's localStorage).
// Everything lives in this browser (localStorage); photos only in memory.
import type {
  BadgeSettings, Checkpoint, CheckStatus, CustomField, CustomValues, ExpectedVisitor, Features, IdType, IncidentType, KeyKind,
  EntryValues, Lang, NoteCategory, RegisterDef, Role, Settings, Severity, VehicleType, WatchLevel
} from '@shared/types'
import { templatesFor } from '@shared/registerTemplates'
import { BRAND } from '@desktop/brand'
import { F, sampleId, type SampleEntry } from './flavors'

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
}
export type DExpected = ExpectedVisitor
/** register engine: an entry keeps the names as they were, like the main process */
/** the audit trail, like the audit table of the desktop app */
export interface DAudit { id: number; time: string; userId: number | null; action: string; entity: string; entityId: number | null; detail: string }

export interface DEntry {
  id: number; registerId: number; number: number; values: EntryValues; createdById: number; createdBy: string; createdAt: string
  post: string; closedBy: string | null; closedAt: string | null
}
export interface DCorrection { id: number; entryId: number; fieldKey: string; oldValue: EntryValues[string] | null; newValue: EntryValues[string] | null; reason: string; by: string; at: string }

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
  /** optional: stores saved before the audit trail existed have none */
  audit?: DAudit[]
  registers: RegisterDef[]
  entries: DEntry[]
  corrections: DCorrection[]
  retentionDays: number
  seq: number
}

// one store per brand, so the generic and the branded demo never mix their data
const KEY = 'secreg-demo-faculty'
// 2: registers (generic engine) · 3: faculty registers and sample entries · 4: no server/dashboard data
const VERSION = 4

const iso = (msAgo: number): string => new Date(Date.now() - msAgo).toISOString()
const H = 3600000
const M = 60000
const dayStr = (offsetDays = 0): string => {
  const d = new Date(Date.now() + offsetDays * 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function seed(): DemoStore {
  // names of the administrator and of the guard who wrote the handover
  const A = F.users[0].name
  const G = F.users[1].name
  const v = (id: number, inAgo: number, outAgo: number | null): DVisit => {
    const f = F.visits[id - 1]
    return {
      id, fullName: f.name, fullNameAlt: f.alt ?? '', idType: 'national_id', idNumber: sampleId(id), nationality: F.nationality, birthDate: '', sex: '', phone: '',
      company: f.company, host: f.host, purpose: f.purpose, badgeNo: `V-${id}`, vehiclePlate: f.plate ?? '', notes: '', timeIn: iso(inAgo), timeOut: outAgo === null ? null : iso(outAgo),
      guardIn: id % 2 ? G : A, guardOut: outAgo === null ? null : G, custom: {}, hasPhoto: false
    }
  }
  const [v1] = F.visits
  const registers = templatesFor(F.registerKeys ?? ['lost_found', 'custody']).map((r, i) => ({ ...r, id: i + 1, openedAt: iso(40 * 24 * H), openedBy: A }))
  /** local "YYYY-MM-DDTHH:MM", the format of datetime fields */
  const at = (hoursAgo: number): string => {
    const d = new Date(Date.now() - hoursAgo * H)
    return new Date(d.getTime() - d.getTimezoneOffset() * M).toISOString().slice(0, 16)
  }
  const helpers = { day: (o: number) => dayStr(o), at, user: (i: number) => ({ userId: i + 1, name: F.users[i].name }) }
  const defaults: SampleEntry[] = [
    { register: 'lost_found', hoursAgo: 26, by: 0, closedHoursAgo: 3, closedBy: 1, values: (h) => ({
      item: F.lostSample.item, place: F.lostSample.place, found_on: h.day(-1), finder: F.lostSample.finder,
      owner: { name: F.visits[6].name, idType: 'CNI', idNumber: sampleId(7) } }) },
    { register: 'lost_found', hoursAgo: 2, by: 1, values: (h) => ({ item: F.keys[2], place: F.checkpoints[3][0], found_on: h.day(0), finder: F.visits[2].name }) }
  ]
  const sampleEntries = (regs: { id: number; key: string }[]): DEntry[] => {
    const numbers = new Map<number, number>()
    return (F.samples ?? defaults).flatMap((x, i) => {
      const reg = regs.find((r) => r.key === x.register)
      if (!reg) return []
      const number = (numbers.get(reg.id) ?? 0) + 1
      numbers.set(reg.id, number)
      return [{
        id: i + 1, registerId: reg.id, number, values: x.values(helpers), createdById: x.by + 1, createdBy: F.users[x.by].name,
        createdAt: iso(x.hoursAgo * H), post: F.postName,
        closedBy: x.closedHoursAgo !== undefined ? F.users[x.closedBy ?? 0].name : null,
        closedAt: x.closedHoursAgo !== undefined ? iso(x.closedHoursAgo * H) : null
      }]
    })
  }
  const [d1, d2, d3] = F.deliveries
  const [e1, e2, e3] = F.expected

  const entries = sampleEntries(registers)

  return {
    version: VERSION,
    settings: { siteName: F.siteName, postName: F.postName, retentionDays: 365, overstayHours: 8, closingTime: '', vehicleOverstayHours: 0, patrolIntervalHours: 4 },
    features: BRAND.features,
    badge: { printer: '', size: 'cr80', autoPrint: false, showPhoto: true },
    users: F.users.map((u, i) => ({ id: i + 1, ...u, active: true })),
    currentUserId: null,
    visits: [v(1, 9.5 * H, null), v(2, 70 * M, null), v(3, 25 * M, null), v(4, 5 * H, 4.6 * H), v(5, 4 * H, 3.2 * H), v(6, 3 * H, 2.1 * H), v(7, 26 * H, 24 * H)],
    notes: [
      { id: 1, time: iso(3.5 * H), category: 'patrol', text: F.notes[0], guard: G },
      { id: 2, time: iso(2.2 * H), category: 'maintenance', text: F.notes[1], guard: G },
      { id: 3, time: iso(40 * M), category: 'general', text: F.notes[2], guard: A }
    ],
    vehicles: [
      { id: 1, plate: v1.plate ?? '', vehicleType: 'car', color: 'Gris', driverName: v1.name, company: v1.company, passengers: 0, cargo: '', notes: '', visitId: 1,
        timeIn: iso(9.5 * H), timeOut: null, guardIn: G, guardOut: null, custom: {}, hasPhoto: false },
      { id: 2, plate: F.van.plate, vehicleType: 'van', color: 'Blanc', driverName: F.van.driver, company: F.van.company, passengers: 1, cargo: 'Colis', notes: '', visitId: null,
        timeIn: iso(15 * M), timeOut: null, guardIn: A, guardOut: null, custom: {}, hasPhoto: false }
    ],
    deliveries: [
      { id: 1, time: iso(2 * H), carrier: d1.carrier, courierName: F.van.driver, recipient: d1.recipient, parcels: 3, tracking: d1.tracking, notes: '', guard: G,
        pickedUpAt: null, pickedUpBy: '', guardPickup: null, custom: {}, hasPhoto: false },
      { id: 2, time: iso(50 * M), carrier: d2.carrier, courierName: '', recipient: d2.recipient, parcels: 1, tracking: '', notes: '', guard: A,
        pickedUpAt: null, pickedUpBy: '', guardPickup: null, custom: {}, hasPhoto: false },
      { id: 3, time: iso(6 * H), carrier: d3.carrier, courierName: '', recipient: d3.recipient, parcels: 1, tracking: d3.tracking, notes: '', guard: G,
        pickedUpAt: iso(5 * H), pickedUpBy: d3.pickedUpBy, guardPickup: G, custom: {}, hasPhoto: false }
    ],
    incidents: [
      { id: 1, type: 'suspicious', severity: 'medium', occurredAt: iso(80 * M), createdAt: iso(78 * M), location: F.incidentPlaces[0], description: 'Personne qui fait le tour des voitures, partie à l’arrivée de l’agent.',
        peopleInvolved: 'Homme, veste noire', actionTaken: 'Ronde renforcée sur le parking', guard: G, closedAt: null, closedBy: null, resolution: '', photoCount: 0 },
      { id: 2, type: 'lost_found', severity: 'low', occurredAt: iso(27 * H), createdAt: iso(27 * H), location: F.incidentPlaces[1], description: 'Portefeuille trouvé.',
        peopleInvolved: '', actionTaken: 'Gardé au poste', guard: A, closedAt: iso(25 * H), closedBy: A, resolution: 'Rendu au propriétaire (étudiant)', photoCount: 0 }
    ],
    shifts: [
      { id: 1, userId: 2, guard: G, post: F.postName, startedAt: iso(12 * H), endedAt: iso(10 * M), handoverNote: F.handover, acknowledgedBy: null }
    ],
    checkpoints: F.checkpoints.map(([name, location], i) => ({ id: i + 1, name, location, code: ['A1B2C3D4', 'E5F6G7H8', 'J9K2L3M4', 'N5P6Q7R8'][i], active: true })),
    rounds: [
      { id: 1, guardId: 2, guard: G, startedAt: iso(5 * H), endedAt: iso(4.6 * H), note: 'RAS',
        checks: [1, 2, 3, 4].map((c, i) => ({ checkpointId: c, time: iso(5 * H - i * 5 * M), status: 'ok' as CheckStatus, note: '', method: (i % 2 ? 'qr' : 'manual') as 'qr' | 'manual' })) }
    ],
    keyItems: [
      { id: 1, label: F.keys[0], kind: 'key', code: 'K-01', location: 'Armoire 1', active: true },
      { id: 2, label: F.keys[1], kind: 'radio', code: 'R-1', location: 'Chargeur', active: true },
      { id: 3, label: F.keys[2], kind: 'badge', code: 'B-VIP', location: 'Tiroir', active: true },
      { id: 4, label: F.keys[3], kind: 'key', code: 'K-07', location: 'Armoire 2', active: true }
    ],
    loans: [
      { id: 1, itemId: 1, borrower: F.loans[0].borrower, borrowerInfo: F.loans[0].info, outAt: iso(20 * M), dueAt: iso(-60 * M), returnedAt: null, guardOut: A, guardIn: null, notes: '' },
      { id: 2, itemId: 4, borrower: F.loans[1].borrower, borrowerInfo: F.loans[1].info, outAt: iso(3 * H), dueAt: iso(30 * M), returnedAt: null, guardOut: G, guardIn: null, notes: '' }
    ],
    watch: [
      { id: 1, name: F.watch.name, idNumber: F.watch.idNumber, plate: '', reason: F.watch.reason, level: 'deny', active: true, addedBy: 'Direction', createdAt: iso(30 * 24 * H) }
    ],
    customFields: [
      { id: 1, entity: 'visit', labels: { ar: 'نوع الشارة', en: 'Badge type', fr: 'Type de badge' }, type: 'select', options: ['Visiteur', 'Prestataire', 'VIP'], required: false, active: true }
    ],
    expected: [
      { id: 1, refCode: 'ZX2SP6', fullName: e1.name, company: e1.company, host: e1.host, purpose: e1.purpose, phone: '', validFrom: dayStr(), validTo: dayStr(),
        notes: '', status: 'pending', arrivedAt: null, visitId: null },
      { id: 2, refCode: 'QM7TA4', fullName: e2.name, company: e2.company, host: e2.host, purpose: e2.purpose, phone: '', validFrom: dayStr(), validTo: dayStr(1),
        notes: e2.notes, status: 'pending', arrivedAt: null, visitId: null },
      { id: 3, refCode: 'HT3PB9', fullName: e3.name, company: e3.company, host: e3.host, purpose: e3.purpose, phone: '', validFrom: dayStr(1), validTo: dayStr(1),
        notes: '', status: 'pending', arrivedAt: null, visitId: null }
    ],
    registers,
    entries,
    audit: [
      { id: 1, time: iso(40 * 24 * H), userId: 1, action: 'setup', entity: '', entityId: null, detail: '' },
      ...entries.flatMap((e) => [
        { id: 0, time: e.createdAt, userId: e.createdById, action: 'entry_add', entity: 'register_entry', entityId: e.id, detail: String(e.registerId) },
        ...(e.closedAt ? [{ id: 0, time: e.closedAt, userId: F.users.findIndex((x) => x.name === e.closedBy) + 1, action: 'entry_close', entity: 'register_entry', entityId: e.id, detail: String(e.registerId) }] : [])
      ])
    ].map((a, i) => ({ ...a, id: i + 1 })),
    corrections: [],
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

/** Saves after every change; another tab picks it up on its next read */
export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db()))
  } catch {
    // private mode / storage full: the demo keeps working in memory
  }
}

/** Reload from storage (changes made in another demo tab) */
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
