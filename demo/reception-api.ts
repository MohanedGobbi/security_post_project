// window.api for the browser demo of the reception app: same contract as the Electron main process,
// backed by the demo store instead of SQLite, OCR and printers.
import type {
  ActivityItem, AlertItem, Api, BadgeSettings, Checkpoint, DeliveryRow, ExpectedVisitor, Features, IncidentRow, KeyItem, KeyLoan, Lang,
  PatrolRound, PatrolRoundDetail, PersonFields, RangeQuery, RegisterDef, RegisterEntry, Role, ScanResult, SearchQuery, ShiftRow, ShiftSummary, User, VehicleRow, VisitDetail,
  VisitRow, WatchHit, WatchRow
} from '@shared/types'
import { formatDateTime, translate } from '@shared/i18n'
import { normalizeFeatures, PROFILES, summaryKeyOn } from '@shared/features'
import { QR_BADGE, QR_PREREG } from '@shared/qr'
import {
  db, dayBounds, fail, nextId, nowIso, photos, refresh, save, today, wait,
  type DEntry, type DExpected, type DLoan, type DRound, type DShift, type DUser, type DVisit
} from './store'
import { MAX_CARD_PICTURES, type Student } from '@shared/types'
import { BUILTIN_LEVELS } from '@shared/permissions'
import { cleanDefinition, cleanStep, cleanValue, type ValueResolvers } from '@shared/registers'
import { templatesFor } from '@shared/registerTemplates'
import { qrDataUrl, qrSvg, readQr } from './qr'
import { downloadCsv, openReport } from './report'
import { F, sampleId } from './flavors'
import { BRAND } from '@renderer/brand'

// ---------- helpers ----------
const normId = (s: string): string => s.toUpperCase().replace(/[\s\-.<\/]/g, '')
const normPlate = (p: string): string => p.toUpperCase().replace(/[\s\-.·]/g, '')
const normName = (n: string): string => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean).sort().join(' ')
const has = (hay: unknown[], text: string): boolean => {
  const n = text.trim().toLowerCase()
  return !n || hay.some((h) => String(h ?? '').toLowerCase().includes(n))
}
const inRange = (t: string | null, from: string, to: string): boolean => {
  if (!t) return false
  const [a, b] = dayBounds(from, to)
  return t >= a && t <= b
}
const between = (t: string | null, a: string, b: string): boolean => !!t && t >= a && t <= b

function me(): DUser {
  refresh()
  const u = db().users.find((x) => x.id === db().currentUserId && x.active)
  if (!u) fail('error.forbidden')
  return u as DUser
}
const admin = (): DUser => {
  const u = me()
  if (u.role !== 'admin') fail('error.forbidden')
  return u
}
const need = (m: keyof Features['modules']): void => {
  if (!db().features.modules[m]) fail('error.featureOff')
}
const toUser = (u: DUser): User => ({
  id: u.id, name: u.name, role: u.role, language: u.language, active: u.active,
  permissions: BUILTIN_LEVELS.find((l) => l.key === u.role)?.permissions ?? []
})
// ---------- register engine (same rules as src/main/registers.ts, shared in @shared/registers) ----------
/** one line of the audit trail, by the current user (null = nobody logged in) */
function log(action: string, entity = '', entityId: number | null = null, detail = ''): void {
  const s = db()
  s.audit ??= []
  s.audit.push({ id: nextId(), time: nowIso(), userId: s.currentUserId, action, entity, entityId, detail })
}

function regOf(id: number): RegisterDef {
  const r = db().registers.find((x) => x.id === id)
  if (!r) fail('error.notFound')
  return r as RegisterDef
}
function entryOf(id: number): DEntry {
  const e = db().entries.find((x) => x.id === id)
  if (!e) fail('error.notFound')
  return e as DEntry
}
function usableReg(id: number, u: DUser, action: 'fill' | 'close'): RegisterDef {
  const reg = regOf(id)
  if (!reg.active) fail('error.featureOff')
  if (u.role !== 'admin' && !(action === 'fill' ? reg.fillRoles : reg.closeRoles).includes(u.role)) fail('error.forbidden')
  return reg
}
const resolvers = (): ValueResolvers => ({
  account: (userId) => {
    const x = db().users.find((y) => y.id === userId && y.active)
    return x ? { userId: x.id, name: x.name } : null
  },
  signature: (pin) => {
    const x = db().users.find((y) => y.pin === pin && y.active)
    return x ? { userId: x.id, name: x.name } : null
  }
})
const toEntry = (e: DEntry): RegisterEntry => ({
  id: e.id, registerId: e.registerId, number: e.number, values: e.values, createdBy: e.createdBy, createdAt: e.createdAt, post: e.post,
  closedBy: e.closedBy, closedAt: e.closedAt, corrected: [...new Set(db().corrections.filter((c) => c.entryId === e.id).map((c) => c.fieldKey))]
})

/** Roles an administrator can give; anything else becomes a guard */
const checkRole = (r: string): Role => (r === 'admin' || r === 'leader' ? r : 'guard')
const lang = (): Lang => (db().users.find((u) => u.id === db().currentUserId)?.language ?? 'fr')
const done = <T>(v: T): T => {
  save()
  return v
}

// ---------- visits ----------
const visitRow = (v: DVisit): VisitRow => ({
  id: v.id, personId: v.id, fullName: v.fullName, fullNameAlt: v.fullNameAlt, idType: v.idType, idNumber: v.idNumber, company: v.company,
  host: v.host, purpose: v.purpose, badgeNo: v.badgeNo, vehiclePlate: v.vehiclePlate, notes: v.notes, timeIn: v.timeIn, timeOut: v.timeOut,
  guardIn: v.guardIn, guardOut: v.guardOut, hasPhoto: v.hasPhoto, cardCount: photos.get(`visitcards:${v.id}`)?.length ?? 0, custom: v.custom
})

function watchHits(q: { idNumber?: string; name?: string; plate?: string }): WatchHit[] {
  if (!db().features.modules.watchlist) return []
  const out: WatchHit[] = []
  for (const w of db().watch.filter((x) => x.active)) {
    if (q.idNumber && normId(q.idNumber) && w.idNumber && normId(w.idNumber) === normId(q.idNumber)) out.push({ id: w.id, level: w.level, reason: w.reason, name: w.name, match: 'id' })
    else if (q.plate && normPlate(q.plate).length >= 3 && w.plate && normPlate(w.plate) === normPlate(q.plate)) out.push({ id: w.id, level: w.level, reason: w.reason, name: w.name, match: 'plate' })
    else if (q.name && normName(q.name).includes(' ') && w.name && normName(w.name) === normName(q.name)) out.push({ id: w.id, level: w.level, reason: w.reason, name: w.name, match: 'name' })
  }
  return out
}

function enforceWatch(q: { idNumber?: string; name?: string; plate?: string }, pin?: string): void {
  const blocking = watchHits(q).some((h) => h.level === 'deny' && h.match !== 'name')
  if (!blocking) return
  if (!pin) fail('error.watchlistDeny')
  if (!db().users.some((u) => u.role === 'admin' && u.active && u.pin === pin)) fail('error.supervisorPin')
}

function checkCustom(entity: 'visit' | 'vehicle' | 'delivery', values: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of db().customFields.filter((x) => x.entity === entity && x.active)) {
    const v = String(values?.[String(f.id)] ?? '').trim()
    if (f.required && !v) fail(`error.customRequired:${f.id}`)
    if (v) out[String(f.id)] = v
  }
  return out
}

/** Sample cards returned by "Scan card" in turn: a new visitor, a watchlisted person, a returning visitor */
const SAMPLE_CARDS: Partial<PersonFields>[] = [
  { fullName: 'Anna Maria Eriksson', idType: 'passport', idNumber: 'L898902C3', nationality: 'SWE', birthDate: '1974-08-12', sex: 'F' },
  // on the watchlist: shows the refusal
  { fullName: F.watch.name, idType: 'national_id', idNumber: F.watch.idNumber, nationality: F.nationality, birthDate: '1990-03-02', sex: 'M' },
  // came yesterday: shows the returning-visitor fill
  { fullName: F.visits[6].name, idType: 'national_id', idNumber: sampleId(7), nationality: F.nationality, birthDate: '1996-06-14', sex: 'F' }
]
let sampleIndex = 0

// ---------- shifts / activity ----------
function summary(from: string, to: string): ShiftSummary {
  const s = db()
  const sum = (xs: { parcels: number }[]): number => xs.reduce((n, x) => n + x.parcels, 0)
  return {
    visitorsIn: s.visits.filter((v) => between(v.timeIn, from, to)).length,
    visitorsOut: s.visits.filter((v) => between(v.timeOut, from, to)).length,
    vehiclesIn: s.vehicles.filter((v) => between(v.timeIn, from, to)).length,
    vehiclesOut: s.vehicles.filter((v) => between(v.timeOut, from, to)).length,
    parcelsReceived: sum(s.deliveries.filter((d) => between(d.time, from, to))),
    parcelsPickedUp: sum(s.deliveries.filter((d) => between(d.pickedUpAt, from, to))),
    incidents: s.incidents.filter((i) => between(i.occurredAt, from, to)).length,
    notes: s.notes.filter((n) => between(n.time, from, to)).length,
    patrols: s.rounds.filter((r) => between(r.endedAt, from, to)).length,
    insideNow: s.visits.filter((v) => !v.timeOut).length,
    vehiclesInside: s.vehicles.filter((v) => !v.timeOut).length,
    parcelsWaiting: sum(s.deliveries.filter((d) => !d.pickedUpAt)),
    openIncidents: s.incidents.filter((i) => !i.closedAt).length,
    keysOut: s.loans.filter((l) => !l.returnedAt).length
  }
}

const shiftRow = (x: DShift): ShiftRow => ({
  id: x.id, userId: x.userId, guard: x.guard, post: x.post, startedAt: x.startedAt, endedAt: x.endedAt, handoverNote: x.handoverNote, acknowledgedBy: x.acknowledgedBy
})

function activity(from: string, to: string | null): ActivityItem[] {
  const s = db()
  const end = to ?? nowIso()
  const out: ActivityItem[] = []
  const add = (time: string | null, kind: ActivityItem['kind'], title: string, detail: string, guard: string | null): void => {
    if (between(time, from, end)) out.push({ time: time as string, kind, title, detail, guard: guard ?? '' })
  }
  for (const v of s.visits) { add(v.timeIn, 'visit_in', v.fullName, v.host, v.guardIn); add(v.timeOut, 'visit_out', v.fullName, v.notes, v.guardOut) }
  for (const v of s.vehicles) { add(v.timeIn, 'vehicle_in', v.plate, v.driverName, v.guardIn); add(v.timeOut, 'vehicle_out', v.plate, v.driverName, v.guardOut) }
  for (const d of s.deliveries) { add(d.time, 'delivery', d.recipient, `${d.carrier} ×${d.parcels}`, d.guard); add(d.pickedUpAt, 'pickup', d.recipient, d.pickedUpBy, d.guardPickup) }
  for (const i of s.incidents) { add(i.occurredAt, 'incident', i.type, [i.location, i.description].filter(Boolean).join(' — '), i.guard); add(i.closedAt, 'incident_closed', i.type, i.resolution, i.closedBy) }
  for (const n of s.notes) add(n.time, 'note', n.category, n.text, n.guard)
  for (const x of s.shifts) { add(x.startedAt, 'shift_start', x.guard, x.post, x.guard); add(x.endedAt, 'shift_end', x.guard, x.handoverNote, x.guard) }
  for (const r of s.rounds) add(r.endedAt, 'patrol', `${r.checks.length} / ${s.checkpoints.filter((c) => c.active).length}`, r.note, r.guard)
  for (const l of s.loans) {
    const item = s.keyItems.find((k) => k.id === l.itemId)?.label ?? ''
    add(l.outAt, 'key_out', item, l.borrower, l.guardOut); add(l.returnedAt, 'key_in', item, l.borrower, l.guardIn)
  }
  return out.sort((a, b) => (a.time < b.time ? -1 : 1))
}

// ---------- patrols ----------
function roundDetail(r: DRound): PatrolRoundDetail {
  const cps = db().checkpoints.filter((c) => c.active || r.checks.some((k) => k.checkpointId === c.id))
  return {
    id: r.id, guard: r.guard, startedAt: r.startedAt, endedAt: r.endedAt, note: r.note, total: cps.length, done: r.checks.length,
    issues: r.checks.filter((c) => c.status === 'issue').length,
    checks: cps.map((c) => {
      const k = r.checks.find((x) => x.checkpointId === c.id)
      return { checkpointId: c.id, name: c.name, location: c.location, time: k?.time ?? null, status: k?.status ?? null, note: k?.note ?? '', method: k?.method ?? '' }
    })
  }
}
const roundRow = (r: DRound): PatrolRound => {
  const { checks: _c, ...rest } = roundDetail(r)
  return rest
}

// ---------- keys ----------
const loanRow = (l: DLoan): KeyLoan => ({
  ...l, itemLabel: db().keyItems.find((k) => k.id === l.itemId)?.label ?? ''
})

// ---------- expected ----------
const expectedRow = (e: DExpected): ExpectedVisitor => ({
  id: e.id, refCode: e.refCode, fullName: e.fullName, company: e.company, host: e.host, purpose: e.purpose, phone: e.phone, validFrom: e.validFrom,
  validTo: e.validTo, notes: e.notes, status: e.status, arrivedAt: e.arrivedAt, visitId: e.visitId
})
const newRef = (): string => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join('')
}

// ---------- badges (drawn on a canvas instead of a printer page) ----------
const BADGE_MM: Record<BadgeSettings['size'], [number, number]> = { cr80: [85.6, 54], label62: [62, 100], a6: [105, 148] }

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = src
  await img.decode()
  return img
}

async function badgePng(visitId: number, s: BadgeSettings): Promise<string> {
  const v = db().visits.find((x) => x.id === visitId)
  if (!v) fail('error.notFound')
  const visit = v as DVisit
  const l = lang()
  const t = (k: string): string => translate(l, k)
  const [wmm, hmm] = BADGE_MM[s.size]
  const k = 6 // px per mm
  const c = document.createElement('canvas')
  c.width = Math.round(wmm * k)
  c.height = Math.round(hmm * k)
  const g = c.getContext('2d') as CanvasRenderingContext2D
  const rtl = l === 'ar'
  g.direction = rtl ? 'rtl' : 'ltr'
  const x0 = rtl ? c.width - 3 * k : 3 * k
  g.textAlign = rtl ? 'right' : 'left'
  g.fillStyle = '#fff'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = BRAND.badgeColor
  g.fillRect(0, 0, c.width, 9 * k)
  g.fillStyle = '#fff'
  g.font = `700 ${5 * k}px Segoe UI, Arial`
  g.fillText(t('badge.visitor'), x0, 6.5 * k)
  g.font = `${2.3 * k}px Segoe UI, Arial`
  g.textAlign = rtl ? 'left' : 'right'
  g.fillText(db().settings.siteName, rtl ? 3 * k : c.width - 3 * k, 6 * k, c.width * 0.5)
  g.textAlign = rtl ? 'right' : 'left'
  g.fillStyle = '#111'
  let y = 16 * k
  const photo = photos.get(`visit:${visitId}`)?.[0]
  let textX = x0
  if (s.showPhoto && photo) {
    const img = await loadImage(URL.createObjectURL(new Blob([photo as BlobPart], { type: 'image/jpeg' })))
    const pw = 18 * k
    g.drawImage(img, rtl ? c.width - 3 * k - pw : 3 * k, 12 * k, pw, pw * 1.2)
    textX = rtl ? c.width - 24 * k : 24 * k
  }
  g.font = `700 ${4.2 * k}px Segoe UI, Arial`
  g.fillText(visit.fullName, textX, y, c.width * 0.62)
  g.font = `${2.6 * k}px Segoe UI, Arial`
  for (const line of [visit.company, visit.host && `${t('badge.visiting')}: ${visit.host}`, `${t('visitor.timeIn')}: ${formatDateTime(visit.timeIn, l)}`]) {
    if (!line) continue
    y += 4.4 * k
    g.fillText(line, textX, y, c.width * 0.62)
  }
  const qr = await loadImage(await qrDataUrl(`${QR_BADGE}${visitId}`))
  const q = Math.min(20 * k, c.height * 0.42)
  g.drawImage(qr, rtl ? 3 * k : c.width - 3 * k - q, c.height - q - 6 * k, q, q)
  g.font = `${2.2 * k}px Segoe UI, Arial`
  g.fillStyle = '#555'
  if (visit.badgeNo) g.fillText(`${t('visitor.badgeNo')}: ${visit.badgeNo}`, x0, c.height - 2 * k)
  return c.toDataURL('image/png')
}

// ---------- the API ----------
/** a few students for the web demo */
const DEMO_STUDENTS: Student[] = [
  { id: 1, studentNo: '20230001', idNumber: '', fullName: 'Khadidja Benyoucef', fullNameAlt: 'خديجة بن يوسف', birthDate: '2003-06-14', phone: '', level: 'L2', department: 'حقوق', notes: '', active: true },
  { id: 2, studentNo: '20220417', idNumber: '', fullName: 'Rachid Bahaz', fullNameAlt: 'رشيد باحاز', birthDate: '2002-03-02', phone: '', level: 'L3', department: 'علوم سياسية', notes: '', active: true }
]

export const demoApi: Api = {
  auth: {
    async status() {
      refresh()
      const s = db()
      const u = s.users.find((x) => x.id === s.currentUserId && x.active)
      return { user: u ? toUser(u) : null, siteName: s.settings.siteName, features: normalizeFeatures(s.features) }
    },
    async loginUsers() {
      refresh()
      return db().users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name, role: u.role }))
    },
    async login(userId, pin) {
      await wait(250)
      const u = db().users.find((x) => x.id === userId && x.active)
      if (!u || u.pin !== String(pin)) {
        log('login_failed', '', userId)
        done(undefined)
        fail('login.wrongPin')
      }
      db().currentUserId = userId
      log('login')
      return done(toUser(u as DUser))
    },
    async loginPin(pin) {
      await wait(250)
      refresh()
      const u = db().users.find((x) => x.pin === String(pin) && x.active)
      if (!u) {
        log('login_failed', '', null, 'pin')
        done(undefined)
        fail('login.wrongPin')
      }
      db().currentUserId = (u as DUser).id
      log('login', '', null, 'pin')
      return done(toUser(u as DUser))
    },
    async logout() {
      log('logout')
      db().currentUserId = null
      done(undefined)
    },
    async setLanguage(l) {
      me().language = l
      done(undefined)
    }
  },

  visits: {
    async lookup(idNumber) {
      const n = normId(idNumber)
      if (n.length < 4) return null
      const list = db().visits.filter((v) => normId(v.idNumber) === n).sort((a, b) => (a.timeIn < b.timeIn ? 1 : -1))
      if (!list.length) return null
      const last = list[0]
      return {
        personId: last.id, visitsCount: list.length, lastSeen: last.timeIn, insideVisitId: list.find((v) => !v.timeOut)?.id ?? null,
        lastHost: last.host, lastPurpose: last.purpose,
        fields: { fullName: last.fullName, fullNameAlt: last.fullNameAlt, idType: last.idType, idNumber: last.idNumber, nationality: last.nationality,
          birthDate: last.birthDate, sex: last.sex, phone: last.phone, company: last.company }
      }
    },
    async checkIn(input) {
      const u = me()
      const s = db()
      if (!input.fullName.trim()) fail('error.nameRequired')
      if (!normId(input.idNumber) && s.features.requireIdNumber) fail('error.idRequired')
      enforceWatch({ idNumber: input.idNumber, name: input.fullName, plate: input.vehiclePlate }, input.supervisorPin)
      const custom = checkCustom('visit', input.custom)
      await wait(200)
      const id = nextId()
      const plate = input.vehiclePlate.trim().toUpperCase()
      s.visits.push({
        id, fullName: input.fullName.trim(), fullNameAlt: input.fullNameAlt.trim(), idType: input.idType, idNumber: normId(input.idNumber),
        nationality: input.nationality, birthDate: input.birthDate, sex: input.sex, phone: input.phone, company: input.company.trim(), host: input.host.trim(),
        purpose: input.purpose.trim(), badgeNo: input.badgeNo.trim(), vehiclePlate: plate, notes: input.notes.trim(), timeIn: nowIso(), timeOut: null,
        guardIn: u.name, guardOut: null, custom, hasPhoto: !!input.photo
      })
      if (input.photo) photos.set(`visit:${id}`, [input.photo])
      // pictures of the ID card (kept in memory in the demo, like photos)
      if (input.cards?.length) photos.set(`visitcards:${id}`, input.cards.slice(0, MAX_CARD_PICTURES))
      if (plate) s.vehicles.push({ id: nextId(), plate, vehicleType: 'car', color: '', driverName: input.fullName, company: input.company, passengers: 0, cargo: '',
        notes: '', visitId: id, timeIn: nowIso(), timeOut: null, guardIn: u.name, guardOut: null, custom: {}, hasPhoto: false })
      const e = s.expected.find((x) => x.id === input.expectedId && x.status === 'pending')
      if (e) Object.assign(e, { status: 'arrived', arrivedAt: nowIso(), visitId: id })
      log('check_in', 'visit', id)
      return done(id)
    },
    async checkOut(visitId, note) {
      const u = me()
      const v = db().visits.find((x) => x.id === visitId)
      if (!v) fail('error.notFound')
      const visit = v as DVisit
      if (visit.timeOut) fail('error.alreadyOut')
      visit.timeOut = nowIso()
      visit.guardOut = u.name
      if (note.trim()) visit.notes = [visit.notes, note.trim()].filter(Boolean).join(' | ')
      for (const veh of db().vehicles.filter((x) => x.visitId === visitId && !x.timeOut)) Object.assign(veh, { timeOut: nowIso(), guardOut: u.name })
      log('check_out', 'visit', visitId)
      done(undefined)
    },
    async insideNow() {
      refresh()
      return db().visits.filter((v) => !v.timeOut).sort((a, b) => (a.timeIn < b.timeIn ? 1 : -1)).map(visitRow)
    },
    async search(q: SearchQuery) {
      return db().visits
        .filter((v) => inRange(v.timeIn, q.from, q.to))
        .filter((v) => (q.status === 'inside' ? !v.timeOut : q.status === 'left' ? !!v.timeOut : true))
        .filter((v) => has([v.fullName, v.fullNameAlt, v.company, v.host, v.purpose, v.badgeNo, v.vehiclePlate, v.notes, v.idNumber], q.text))
        .sort((a, b) => (a.timeIn < b.timeIn ? 1 : -1)).map(visitRow)
    },
    async get(visitId): Promise<VisitDetail> {
      const v = db().visits.find((x) => x.id === visitId)
      if (!v) fail('error.notFound')
      const visit = v as DVisit
      return { ...visitRow(visit), nationality: visit.nationality, birthDate: visit.birthDate, sex: visit.sex, phone: visit.phone, photo: photos.get(`visit:${visitId}`)?.[0] ?? null, cards: photos.get(`visitcards:${visitId}`) ?? [] }
    },
    async stats() {
      refresh()
      const s = summary(...dayBounds(today(), today()))
      return {
        inside: s.insideNow, inToday: s.visitorsIn, outToday: s.visitorsOut, notesToday: s.notes,
        vehiclesInside: s.vehiclesInside, parcelsWaiting: s.parcelsWaiting, openIncidents: s.openIncidents
      }
    },
    async suggestions() {
      const top = (xs: string[]): string[] => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())]
        .filter(([x]) => x).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([x]) => x)
      return { hosts: top(db().visits.map((v) => v.host)), purposes: top(db().visits.map((v) => v.purpose)) }
    }
  },

  notes: {
    async add(category, text) {
      need('notes')
      if (!text.trim()) fail('error.textRequired')
      db().notes.push({ id: nextId(), time: nowIso(), category, text: text.trim(), guard: me().name })
      done(undefined)
    },
    async list(from, to) {
      return db().notes.filter((n) => inRange(n.time, from, to)).sort((a, b) => (a.time < b.time ? 1 : -1)).map((n) => ({ ...n }))
    }
  },

  registers: {
    async list() {
      const u = me()
      const all = [...db().registers].sort((a, b) => a.sort - b.sort || a.id - b.id)
      return u.role === 'admin' ? all : all.filter((r) => r.active && (r.fillRoles.includes(u.role) || r.closeRoles.includes(u.role)))
    },
    async save(input) {
      const u = admin()
      const def = cleanDefinition(input)
      const regs = db().registers
      if (regs.some((r) => r.key === def.key && r.id !== def.id)) fail('error.keyTaken')
      const old = def.id ? regs.find((r) => r.id === def.id) : undefined
      if (def.id && !old) fail('error.notFound')
      // a field is never removed: one left out is switched off, and an existing field keeps its type
      const fields = def.fields.map((f) => {
        const was = old?.fields.find((x) => x.key === f.key)
        return was ? { ...f, type: was.type, sensitive: was.sensitive } : f
      })
      for (const f of old?.fields ?? []) if (!fields.some((x) => x.key === f.key)) fields.push({ ...f, active: false })
      const reg: RegisterDef = { ...def, id: old?.id ?? nextId(), fields, openedAt: old?.openedAt ?? nowIso(), openedBy: old?.openedBy ?? u.name }
      db().registers = old ? regs.map((r) => (r.id === reg.id ? reg : r)) : [...regs, reg]
      log(old ? 'register_update' : 'register_open', 'register', reg.id)
      return done(reg.id)
    },
    async entries(q) {
      const u = me()
      const reg = regOf(q.registerId)
      if (u.role !== 'admin' && !reg.fillRoles.includes(u.role) && !reg.closeRoles.includes(u.role)) fail('error.forbidden')
      let rows = db().entries.filter((e) => e.registerId === reg.id)
      if (q.openOnly) rows = rows.filter((e) => !e.closedAt)
      if (u.role === 'admin') {
        if (q.from && q.to) {
          const [from, to] = dayBounds(q.from, q.to)
          rows = rows.filter((e) => (e.createdAt >= from && e.createdAt <= to) || (q.openOnly && !e.closedAt))
        }
      } else {
        // the register stays in the security office: the last 24 hours and what is still open
        const since = new Date(Date.now() - 24 * 3600000).toISOString()
        rows = rows.filter((e) => e.createdAt > since || !e.closedAt)
      }
      const text = q.text.trim().toLowerCase()
      if (text) {
        const plainKeys = reg.fields.filter((f) => !f.sensitive).map((f) => f.key)
        rows = rows.filter((e) => JSON.stringify(plainKeys.map((k) => e.values[k] ?? '')).toLowerCase().includes(text))
      }
      // browsing a register's history is logged, like asking the dean's permission to read the book
      if (u.role === 'admin' && q.from) {
        log('view', 'register', reg.id, `${q.from}..${q.to}`)
        save()
      }
      return rows.sort((a, b) => b.number - a.number).map(toEntry)
    },
    async add(registerId, input) {
      const u = me()
      const reg = usableReg(registerId, u, 'fill')
      const values = cleanStep(reg.fields, 'open', input, resolvers())
      const number = Math.max(0, ...db().entries.filter((e) => e.registerId === reg.id).map((e) => e.number)) + 1
      const id = nextId()
      db().entries.push({ id, registerId: reg.id, number, values, createdById: u.id, createdBy: u.name, createdAt: nowIso(), post: db().settings.postName, closedBy: null, closedAt: null })
      log('entry_add', 'register_entry', id, String(reg.id))
      return done({ id, number })
    },
    async close(entryId, input) {
      const u = me()
      const e = entryOf(entryId)
      const reg = usableReg(e.registerId, u, 'close')
      if (!reg.closeLabels) fail('error.noCloseStep')
      if (e.closedAt) fail('error.entryClosed')
      e.values = { ...e.values, ...cleanStep(reg.fields, 'close', input, resolvers()) }
      e.closedBy = u.name
      e.closedAt = nowIso()
      log('entry_close', 'register_entry', e.id, String(reg.id))
      done(undefined)
    },
    async correct(entryId, fieldKey, input, reason) {
      const u = me()
      const e = entryOf(entryId)
      const field = regOf(e.registerId).fields.find((f) => f.key === fieldKey)
      if (!field) fail('error.notFound')
      if (u.role === 'guard' && e.createdById !== u.id) fail('error.forbidden')
      if (!String(reason ?? '').trim()) fail('error.reasonRequired')
      const value = cleanValue(field as RegisterDef['fields'][number], input, resolvers())
      if (value === null && field?.required) fail(`error.fieldRequired:${fieldKey}`)
      db().corrections.push({ id: nextId(), entryId, fieldKey, oldValue: e.values[fieldKey] ?? null, newValue: value, reason: String(reason).trim(), by: u.name, at: nowIso() })
      if (value === null) delete e.values[fieldKey]
      else e.values[fieldKey] = value
      log('entry_correct', 'register_entry', e.id, fieldKey)
      done(undefined)
    },
    async corrections(entryId) {
      me()
      return db().corrections.filter((c) => c.entryId === entryId).map(({ fieldKey, oldValue, newValue, reason, by, at }) => ({ fieldKey, oldValue, newValue, reason, by, at }))
    },
    async accounts() {
      me()
      return db().users.filter((x) => x.active).map((x) => ({
        id: x.id, name: x.name, role: x.role, roleLabels: BUILTIN_LEVELS.find((l) => l.key === x.role)?.labels ?? { ar: x.role, en: x.role, fr: x.role }
      }))
    },
    async installTemplates(keys) {
      const u = admin()
      const missing = templatesFor(keys).filter((t) => !db().registers.some((r) => r.key === t.key))
      for (const t of missing) db().registers.push({ ...cleanDefinition(t), id: nextId(), openedAt: nowIso(), openedBy: u.name } as RegisterDef)
      if (missing.length) log('register_open', 'register', null, `templates:${missing.length}`)
      return done(missing.length)
    },
    async delete(id) {
      admin()
      const i = db().registers.findIndex((r) => r.id === id)
      if (i < 0) fail('error.notFound')
      const key = db().registers[i].key
      db().registers.splice(i, 1)
      log('register_delete', 'register', null, key)
      done(undefined)
    }
  },

  audit: {
    async list(q) {
      admin()
      const [from, to] = dayBounds(q.from, q.to)
      const name = (id: number | null): string | null => db().users.find((x) => x.id === id)?.name ?? null
      return [...(db().audit ?? [])]
        .filter((a) => a.time >= from && a.time <= to && (!q.userId || a.userId === q.userId) && (!q.action || a.action === q.action))
        .sort((a, b) => (a.time < b.time ? 1 : -1))
        .map((a) => ({ id: a.id, time: a.time, user: name(a.userId), action: a.action, entity: a.entity, entityId: a.entityId, detail: a.detail }))
    }
  },

  // the demo keeps its data in the browser: there is nothing to back up or restore
  system: {
    async info() { return { dataDir: 'browser', backupsDir: '', dbBytes: 0, copies: [], lastBackup: null } },
    async backup() { return null },
    async restoreFile() { return false },
    async restoreCopy() {},
    async erase() {},
    async factoryReset() {},
    async openFolder() {},
    async restart() { location.reload() },
    async recover() { return false }
  },

  levels: {
    async list() {
      return BUILTIN_LEVELS.map((l) => ({ key: l.key, labels: l.labels, permissions: l.permissions, builtin: true, users: db().users.filter((u) => u.role === l.key && u.active).length }))
    },
    async save() { return 'guard' },
    async remove() {}
  },

  users: {
    async list() {
      admin()
      return db().users.map(toUser)
    },
    async create(name, role, pin, language) {
      admin()
      if (!name.trim()) fail('error.nameRequired')
      if (!/^\d{4,8}$/.test(pin)) fail('setup.pinShort')
      if (db().users.some((x) => x.pin === pin)) fail('error.pinTaken')
      const id = nextId()
      db().users.push({ id, name: name.trim(), role: checkRole(role), pin, language, active: true })
      log('user_create', 'user', id)
      done(undefined)
    },
    async update(id, patch) {
      admin()
      const u = db().users.find((x) => x.id === id)
      if (!u) fail('error.notFound')
      const target = u as DUser
      const admins = db().users.filter((x) => x.role === 'admin' && x.active).length
      if (patch.role !== undefined) patch.role = checkRole(patch.role)
      const losesAdmin = patch.active === false || (patch.role !== undefined && patch.role !== 'admin')
      if (target.role === 'admin' && target.active && losesAdmin && admins <= 1) fail('error.lastAdmin')
      if (patch.pin !== undefined && !/^\d{4,8}$/.test(patch.pin)) fail('setup.pinShort')
      if (patch.pin !== undefined && db().users.some((x) => x.pin === patch.pin && x.id !== id)) fail('error.pinTaken')
      Object.assign(target, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
      log('user_update', 'user', id, Object.keys(patch).join(','))
      done(undefined)
    }
  },

  settings: {
    async get() {
      return { ...db().settings }
    },
    async set(s) {
      admin()
      db().settings = { ...s }
      log('settings')
      done(undefined)
    },
    async getFeatures() {
      refresh()
      return normalizeFeatures(db().features)
    },
    async setFeatures(f) {
      admin()
      db().features = normalizeFeatures(f)
      log('features')
      done(undefined)
    }
  },

  scan: {
    async analyze(image): Promise<ScanResult> {
      const codes = image.length ? await readQr(image) : []
      const empty: ScanResult = { source: 'none', fields: {}, valid: false, rawMrz: [], barcodes: codes.map((text) => ({ format: 'QRCode', text })), lines: [] }
      if (codes.some((c) => c.startsWith('SECREG-'))) return empty
      // the desktop app reads the MRZ / barcode with offline OCR; the demo fills a sample card
      await wait(900)
      const fields = SAMPLE_CARDS[sampleIndex++ % SAMPLE_CARDS.length]
      return { ...empty, source: 'mrz', fields, valid: true }
    },
    async readText() {
      await wait(800)
      return F.cardText
    },
    async readFront(): Promise<ScanResult> {
      await wait(800)
      return { source: 'none', fields: {}, valid: false, rawMrz: [], barcodes: [], lines: F.cardText }
    },
    async barcodes(image) {
      return readQr(image)
    }
  },

  students: {
    async list(q) {
      const text = q.text.trim().toLowerCase()
      return DEMO_STUDENTS.filter((s) => !text || `${s.fullName} ${s.fullNameAlt} ${s.studentNo}`.toLowerCase().includes(text)).map((student) => ({
        student, score: 1, exact: false, insideVisitId: null, insideSince: null, lastSeen: null, visitsCount: 0
      }))
    },
    async suggest(q) {
      const text = q.name.trim().toLowerCase()
      return DEMO_STUDENTS.filter((s) => s.studentNo === q.idNumber.trim() || (text.length > 2 && `${s.fullName} ${s.fullNameAlt}`.toLowerCase().includes(text)))
        .map((student) => ({ student, score: 1, exact: student.studentNo === q.idNumber.trim(), insideVisitId: null, insideSince: null, lastSeen: null, visitsCount: 0 }))
    },
    async count() { return DEMO_STUDENTS.length },
    async save() { return 0 },
    async setActive() {},
    async remove() {},
    async import() { return null },
    async template() { return null },
    async pdf() { window.print(); return null },
    async xlsx() { return null }
  },

  exports: {
    async pdf(r) {
      const t = (k: string): string => translate(r.lang, k)
      const visits = await demoApi.visits.search({ from: r.from, to: r.to, text: '', status: 'all' })
      const notes = await demoApi.notes.list(r.from, r.to)
      openReport(r.lang, t('export.reportTitle'), `${r.from} → ${r.to}`, [
        { title: t('export.visitorsTitle'), head: [t('visitor.timeIn'), t('visitor.timeOut'), t('visitor.fullName'), t('visitor.company'), t('visitor.host'), t('visitor.guardIn')],
          rows: visits.reverse().map((v) => [formatDateTime(v.timeIn, r.lang), formatDateTime(v.timeOut, r.lang), v.fullName, v.company, v.host, v.guardIn]) },
        { title: t('export.notesTitle'), head: [t('activity.time'), t('notes.category'), t('notes.text')],
          rows: notes.reverse().map((n) => [formatDateTime(n.time, r.lang), t(`notes.cat.${n.category}`), n.text]) }
      ])
      return t('common.print')
    },
    async excel(r) {
      const t = (k: string): string => translate(r.lang, k)
      const visits = await demoApi.visits.search({ from: r.from, to: r.to, text: '', status: 'all' })
      downloadCsv(`register_${r.from}_${r.to}.csv`, [t('visitor.timeIn'), t('visitor.timeOut'), t('visitor.fullName'), t('visitor.idNumber'), t('visitor.company'), t('visitor.host'), t('visitor.purpose')],
        visits.reverse().map((v) => [formatDateTime(v.timeIn, r.lang), formatDateTime(v.timeOut, r.lang), v.fullName, v.idNumber, v.company, v.host, v.purpose]))
      return `register_${r.from}_${r.to}.csv`
    },
    // the demo prints the visible page instead of building a PDF
    async registerPdf(): Promise<string | null> { window.print(); return null },
    async entryPdf(): Promise<string | null> { window.print(); return null },
    async auditPdf(): Promise<string | null> { window.print(); return null },
    async visitPdf(): Promise<string | null> { window.print(); return null },
    async registerXlsx(): Promise<string | null> { return null },
    async entryXlsx(): Promise<string | null> { return null },
    async auditXlsx(): Promise<string | null> { return null },
    async visitXlsx(): Promise<string | null> { return null },
    async insideXlsx(): Promise<string | null> { return null },
    async evacuation(l) {
      const t = (k: string): string => translate(l, k)
      const rows = await demoApi.visits.insideNow()
      openReport(l, t('export.evacuationTitle'), formatDateTime(nowIso(), l), [{
        title: t('export.visitorsTitle'), head: [t('visitor.fullName'), t('visitor.company'), t('visitor.host'), t('visitor.timeIn'), t('visitor.badgeNo')],
        rows: rows.map((v) => [v.fullName, v.company, v.host, formatDateTime(v.timeIn, l), v.badgeNo])
      }])
      return t('common.print')
    },
    async shiftReport(shiftId, l) {
      const t = (k: string): string => translate(l, k)
      const x = db().shifts.find((s) => s.id === shiftId)
      if (!x) fail('error.notFound')
      const shift = x as DShift
      const end = shift.endedAt ?? nowIso()
      const sum = summary(shift.startedAt, end)
      const cells = (Object.keys(sum) as (keyof ShiftSummary)[]).filter((k) => summaryKeyOn(k, db().features))
        .map((k) => `<div style="border:1px solid #bbb;border-radius:4px;padding:4px 8px"><b style="font-size:13pt">${sum[k]}</b><br>${t(`shift.sum.${k}`)}</div>`).join('')
      openReport(l, t('shift.reportTitle'), `${t('shift.guard')}: ${shift.guard} · ${formatDateTime(shift.startedAt, l)} → ${shift.endedAt ? formatDateTime(shift.endedAt, l) : t('shift.ongoing')}`,
        [{ title: t('activity.title'), head: [t('activity.time'), t('activity.event'), t('activity.subject'), t('activity.detail'), t('activity.guard')],
          rows: activity(shift.startedAt, end).map((a) => [formatDateTime(a.time, l), t(`activity.kind.${a.kind}`), a.title, a.detail, a.guard]) }],
        `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">${cells}</div>` +
        (shift.handoverNote ? `<h2>${t('shift.handover')}</h2><div style="border:2px solid #111;padding:8px">${shift.handoverNote.replace(/</g, '&lt;')}</div>` : ''))
      return t('common.print')
    }
  },

  vehicles: {
    async lookup(plate) {
      const p = normPlate(plate)
      if (p.length < 3) return null
      const list = db().vehicles.filter((v) => normPlate(v.plate) === p).sort((a, b) => (a.timeIn < b.timeIn ? 1 : -1))
      if (!list.length) return null
      const l = list[0]
      return { visits: list.length, lastSeen: l.timeIn, insideId: list.find((v) => !v.timeOut)?.id ?? null,
        last: { vehicleType: l.vehicleType, color: l.color, driverName: l.driverName, company: l.company } }
    },
    async checkIn(input) {
      need('vehicles')
      const u = me()
      const plate = input.plate.trim().toUpperCase()
      if (!normPlate(plate)) fail('error.plateRequired')
      if (db().vehicles.some((v) => !v.timeOut && normPlate(v.plate) === normPlate(plate))) fail('error.vehicleInside')
      enforceWatch({ plate, name: input.driverName }, input.supervisorPin)
      const custom = checkCustom('vehicle', input.custom)
      const id = nextId()
      db().vehicles.push({ id, plate, vehicleType: input.vehicleType, color: input.color, driverName: input.driverName, company: input.company,
        passengers: Number(input.passengers) || 0, cargo: input.cargo, notes: input.notes, visitId: null, timeIn: nowIso(), timeOut: null,
        guardIn: u.name, guardOut: null, custom, hasPhoto: !!input.photo })
      if (input.photo) photos.set(`vehicle:${id}`, [input.photo])
      return done(id)
    },
    async checkOut(id, note) {
      need('vehicles')
      const v = db().vehicles.find((x) => x.id === id)
      if (!v) fail('error.notFound')
      if (v?.timeOut) fail('error.alreadyOut')
      Object.assign(v as object, { timeOut: nowIso(), guardOut: me().name, notes: [v?.notes, note.trim()].filter(Boolean).join(' | ') })
      done(undefined)
    },
    async inside(): Promise<VehicleRow[]> {
      return db().vehicles.filter((v) => !v.timeOut).map((v) => ({ ...v }))
    },
    async search(q: RangeQuery) {
      return db().vehicles.filter((v) => inRange(v.timeIn, q.from, q.to) && has([v.plate, v.driverName, v.company, v.cargo, v.notes], q.text))
        .sort((a, b) => (a.timeIn < b.timeIn ? 1 : -1)).map((v) => ({ ...v }))
    },
    async photo(id) {
      return photos.get(`vehicle:${id}`)?.[0] ?? null
    }
  },

  deliveries: {
    async add(input) {
      need('deliveries')
      if (!input.recipient.trim()) fail('error.recipientRequired')
      const custom = checkCustom('delivery', input.custom)
      const id = nextId()
      db().deliveries.push({ id, time: nowIso(), carrier: input.carrier, courierName: input.courierName, recipient: input.recipient.trim(),
        parcels: Math.max(1, Number(input.parcels) || 1), tracking: input.tracking, notes: input.notes, guard: me().name, pickedUpAt: null,
        pickedUpBy: '', guardPickup: null, custom, hasPhoto: !!input.photo })
      if (input.photo) photos.set(`delivery:${id}`, [input.photo])
      return done(id)
    },
    async pickUp(id, by) {
      need('deliveries')
      if (!by.trim()) fail('error.pickupRequired')
      const d = db().deliveries.find((x) => x.id === id)
      if (!d) fail('error.notFound')
      if (d?.pickedUpAt) fail('error.alreadyPickedUp')
      Object.assign(d as object, { pickedUpAt: nowIso(), pickedUpBy: by.trim(), guardPickup: me().name })
      done(undefined)
    },
    async waiting(): Promise<DeliveryRow[]> {
      return db().deliveries.filter((d) => !d.pickedUpAt).map((d) => ({ ...d }))
    },
    async search(q) {
      return db().deliveries.filter((d) => inRange(d.time, q.from, q.to) && has([d.carrier, d.recipient, d.tracking, d.pickedUpBy, d.notes], q.text))
        .sort((a, b) => (a.time < b.time ? 1 : -1)).map((d) => ({ ...d }))
    },
    async photo(id) {
      return photos.get(`delivery:${id}`)?.[0] ?? null
    },
    async recipients() {
      return [...new Set(db().deliveries.map((d) => d.recipient))].slice(0, 8)
    }
  },

  incidents: {
    async add(input) {
      need('incidents')
      if (!input.description.trim()) fail('error.textRequired')
      const id = nextId()
      db().incidents.push({ id, type: input.type, severity: input.severity, occurredAt: new Date(input.occurredAt).toISOString(), createdAt: nowIso(),
        location: input.location, description: input.description.trim(), peopleInvolved: input.peopleInvolved, actionTaken: input.actionTaken,
        guard: me().name, closedAt: null, closedBy: null, resolution: '', photoCount: input.photos.length })
      if (input.photos.length) photos.set(`incident:${id}`, input.photos)
      return done(id)
    },
    async close(id, resolution) {
      need('incidents')
      const i = db().incidents.find((x) => x.id === id)
      if (!i) fail('error.notFound')
      if (i?.closedAt) fail('error.alreadyClosed')
      Object.assign(i as object, { closedAt: nowIso(), closedBy: me().name, resolution: resolution.trim() })
      done(undefined)
    },
    async open(): Promise<IncidentRow[]> {
      const rank = { high: 0, medium: 1, low: 2 }
      return db().incidents.filter((i) => !i.closedAt).sort((a, b) => rank[a.severity] - rank[b.severity]).map((i) => ({ ...i }))
    },
    async search(q) {
      return db().incidents.filter((i) => inRange(i.occurredAt, q.from, q.to) && has([i.location, i.description, i.peopleInvolved, i.actionTaken, i.resolution], q.text))
        .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)).map((i) => ({ ...i }))
    },
    async get(id) {
      const i = db().incidents.find((x) => x.id === id)
      if (!i) fail('error.notFound')
      return { ...(i as IncidentRow), photos: photos.get(`incident:${id}`) ?? [] }
    }
  },

  shifts: {
    async state() {
      const u = me()
      const s = db()
      const mine = s.shifts.find((x) => x.userId === u.id && !x.endedAt) ?? null
      const previous = [...s.shifts].filter((x) => x.endedAt).sort((a, b) => ((a.endedAt as string) < (b.endedAt as string) ? 1 : -1))[0] ?? null
      const from = mine?.startedAt ?? previous?.startedAt ?? dayBounds(today(), today())[0]
      const to = mine ? nowIso() : previous?.endedAt ?? nowIso()
      return {
        mine: mine ? shiftRow(mine) : null, previous: previous ? shiftRow(previous) : null,
        othersOpen: s.shifts.filter((x) => !x.endedAt && x.userId !== u.id).map(shiftRow), summary: summary(from, to)
      }
    },
    async start() {
      need('shifts')
      const u = me()
      const s = db()
      const existing = s.shifts.find((x) => x.userId === u.id && !x.endedAt)
      if (existing) return shiftRow(existing)
      for (const x of s.shifts.filter((y) => !y.endedAt)) x.endedAt = nowIso()
      const prev = [...s.shifts].filter((x) => x.endedAt).sort((a, b) => ((a.endedAt as string) < (b.endedAt as string) ? 1 : -1))[0]
      if (prev && prev.userId !== u.id && !prev.acknowledgedBy) prev.acknowledgedBy = u.name
      const x: DShift = { id: nextId(), userId: u.id, guard: u.name, post: s.settings.postName, startedAt: nowIso(), endedAt: null, handoverNote: '', acknowledgedBy: null }
      s.shifts.push(x)
      return done(shiftRow(x))
    },
    async end(note) {
      need('shifts')
      const u = me()
      const x = db().shifts.find((y) => y.userId === u.id && !y.endedAt)
      if (!x) fail('error.noShift')
      Object.assign(x as DShift, { endedAt: nowIso(), handoverNote: note.trim() })
      return done(shiftRow(x as DShift))
    },
    async activity(from, to) {
      return activity(from, to)
    },
    async list(q) {
      return db().shifts.filter((x) => inRange(x.startedAt, q.from, q.to) && has([x.guard, x.handoverNote], q.text))
        .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).map(shiftRow)
    }
  },

  patrols: {
    async checkpoints(all) {
      return db().checkpoints.filter((c) => all || c.active).map((c) => ({ ...c }))
    },
    async addCheckpoint(name, location) {
      admin()
      need('patrols')
      if (!name.trim()) fail('error.nameRequired')
      db().checkpoints.push({ id: nextId(), name: name.trim(), location: location.trim(), code: newRef() + newRef().slice(0, 2), active: true })
      done(undefined)
    },
    async updateCheckpoint(id, patch) {
      admin()
      Object.assign(db().checkpoints.find((c) => c.id === id) ?? {}, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
      done(undefined)
    },
    async labelsPdf(l) {
      const cps = db().checkpoints.filter((c) => c.active)
      if (!cps.length) fail('error.noCheckpoints')
      const labels = await Promise.all(cps.map(async (c: Checkpoint) =>
        `<div style="border:1.5px dashed #555;border-radius:4mm;padding:5mm;text-align:center;break-inside:avoid"><div style="width:42mm;height:42mm;margin:auto">${await qrSvg(`SECREG-CP:${c.code}`)}</div>
          <b style="font-size:15pt">${c.name}</b><div>${c.location}</div><code>${c.code}</code><div style="font-size:8pt;color:#666">${translate(l, 'patrol.labelHint')}</div></div>`))
      openReport(l, translate(l, 'patrol.labels'), db().settings.siteName, [], `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm">${labels.join('')}</div>`)
      return translate(l, 'common.print')
    },
    async current() {
      const u = me()
      const r = db().rounds.find((x) => x.guardId === u.id && !x.endedAt)
      return r ? roundDetail(r) : null
    },
    async start() {
      need('patrols')
      const u = me()
      const open = db().rounds.find((x) => x.guardId === u.id && !x.endedAt)
      if (open) return roundDetail(open)
      if (!db().checkpoints.some((c) => c.active)) fail('error.noCheckpoints')
      const r: DRound = { id: nextId(), guardId: u.id, guard: u.name, startedAt: nowIso(), endedAt: null, note: '', checks: [] }
      db().rounds.push(r)
      return done(roundDetail(r))
    },
    async check(roundId, checkpointId, status, note, method) {
      need('patrols')
      const r = db().rounds.find((x) => x.id === roundId)
      if (!r) fail('error.notFound')
      const round = r as DRound
      if (round.endedAt) fail('error.roundFinished')
      if (status === 'issue' && !note.trim()) fail('error.issueNote')
      round.checks = round.checks.filter((c) => c.checkpointId !== checkpointId)
      round.checks.push({ checkpointId, time: nowIso(), status, note: note.trim(), method })
      return done(roundDetail(round))
    },
    async findByCode(code) {
      const c = code.trim().toUpperCase().replace('SECREG-CP:', '')
      return db().checkpoints.find((x) => x.active && x.code === c) ?? null
    },
    async finish(roundId, note) {
      need('patrols')
      const r = db().rounds.find((x) => x.id === roundId)
      if (!r || r.endedAt) fail('error.roundFinished')
      Object.assign(r as DRound, { endedAt: nowIso(), note: note.trim() })
      done(undefined)
    },
    async list(q) {
      return db().rounds.filter((r) => inRange(r.startedAt, q.from, q.to) && has([r.guard, r.note], q.text))
        .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).map(roundRow)
    },
    async get(id) {
      const r = db().rounds.find((x) => x.id === id)
      if (!r) fail('error.notFound')
      return roundDetail(r as DRound)
    }
  },

  keys: {
    async items(all): Promise<KeyItem[]> {
      return db().keyItems.filter((k) => all || k.active).map((k) => {
        const l = db().loans.find((x) => x.itemId === k.id && !x.returnedAt)
        return { ...k, loan: l ? loanRow(l) : null }
      })
    },
    async addItem(input) {
      admin()
      need('keys')
      if (!input.label.trim()) fail('error.nameRequired')
      db().keyItems.push({ id: nextId(), ...input, label: input.label.trim(), active: true })
      done(undefined)
    },
    async setActive(id, active) {
      admin()
      Object.assign(db().keyItems.find((k) => k.id === id) ?? {}, { active })
      done(undefined)
    },
    async lend(itemId, input) {
      need('keys')
      if (!input.borrower.trim()) fail('error.borrowerRequired')
      if (db().loans.some((l) => l.itemId === itemId && !l.returnedAt)) fail('error.keyOut')
      db().loans.push({ id: nextId(), itemId, borrower: input.borrower.trim(), borrowerInfo: input.borrowerInfo, outAt: nowIso(), dueAt: input.dueAt,
        returnedAt: null, guardOut: me().name, guardIn: null, notes: input.notes })
      done(undefined)
    },
    async giveBack(loanId, note) {
      need('keys')
      const l = db().loans.find((x) => x.id === loanId)
      if (!l) fail('error.notFound')
      if (l?.returnedAt) fail('error.alreadyReturned')
      Object.assign(l as object, { returnedAt: nowIso(), guardIn: me().name, notes: [l?.notes, note.trim()].filter(Boolean).join(' | ') })
      done(undefined)
    },
    async loans(q) {
      return db().loans.filter((l) => inRange(l.outAt, q.from, q.to)).map(loanRow).filter((l) => has([l.itemLabel, l.borrower, l.borrowerInfo, l.notes], q.text))
        .sort((a, b) => (a.outAt < b.outAt ? 1 : -1))
    }
  },

  alerts: {
    async list(): Promise<AlertItem[]> {
      refresh()
      const s = db()
      const on = s.features.modules
      const now = Date.now()
      const out: AlertItem[] = []
      let closing: number | null = null
      if (s.settings.closingTime) {
        const c = new Date(`${today()}T${s.settings.closingTime}:00`).getTime()
        if (now > c) closing = c
      }
      for (const v of s.visits.filter((x) => !x.timeOut)) {
        if (s.settings.overstayHours > 0 && now - Date.parse(v.timeIn) > s.settings.overstayHours * 3600000) {
          out.push({ kind: 'visitor_overstay', refId: v.id, title: v.fullName, detail: v.host, since: v.timeIn })
        } else if (closing !== null) out.push({ kind: 'visitor_after_closing', refId: v.id, title: v.fullName, detail: v.host, since: v.timeIn })
      }
      if (on.vehicles && s.settings.vehicleOverstayHours > 0) {
        for (const v of s.vehicles.filter((x) => !x.timeOut && now - Date.parse(x.timeIn) > s.settings.vehicleOverstayHours * 3600000)) {
          out.push({ kind: 'vehicle_overstay', refId: v.id, title: v.plate, detail: v.driverName, since: v.timeIn })
        }
      }
      if (on.keys) {
        for (const l of s.loans.filter((x) => !x.returnedAt && x.dueAt && Date.parse(x.dueAt) < now)) {
          out.push({ kind: 'key_overdue', refId: l.id, title: loanRow(l).itemLabel, detail: l.borrower, since: l.dueAt })
        }
      }
      if (on.patrols && s.settings.patrolIntervalHours > 0 && s.checkpoints.some((c) => c.active)) {
        const last = s.rounds.map((r) => r.endedAt).filter(Boolean).sort().pop() ?? null
        if (!last || now - Date.parse(last) > s.settings.patrolIntervalHours * 3600000) out.push({ kind: 'patrol_due', refId: null, title: '', detail: '', since: last })
      }
      return out
    }
  },

  customFields: {
    async list(all) {
      return db().customFields.filter((f) => all || f.active).map((f) => ({ ...f }))
    },
    async add(input) {
      admin()
      const labels = { ar: input.labels.ar.trim(), en: input.labels.en.trim(), fr: input.labels.fr.trim() }
      if (!labels.ar && !labels.en && !labels.fr) fail('error.labelRequired')
      const options = [...new Set(input.options.map((o) => o.trim()).filter(Boolean))]
      if (input.type === 'select' && options.length < 2) fail('error.optionsRequired')
      db().customFields.push({ id: nextId(), ...input, labels, options, active: true })
      done(undefined)
    },
    async update(id, patch) {
      admin()
      Object.assign(db().customFields.find((f) => f.id === id) ?? {}, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
      done(undefined)
    }
  },

  expected: {
    async list() {
      refresh()
      const t = today()
      const until = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
      const rank = { pending: 0, arrived: 1, cancelled: 2 }
      return db().expected.filter((e) => e.validTo >= t && e.validFrom <= until && e.status !== 'cancelled')
        .sort((a, b) => rank[a.status] - rank[b.status] || a.validFrom.localeCompare(b.validFrom)).map(expectedRow)
    },
    async add(input) {
      need('preregistration')
      if (!input.fullName.trim()) fail('error.nameRequired')
      db().expected.push({ id: nextId(), refCode: newRef(), ...input, fullName: input.fullName.trim(), validTo: input.validTo >= input.validFrom ? input.validTo : input.validFrom,
        status: 'pending', arrivedAt: null, visitId: null })
      done(undefined)
    },
    async cancel(id) {
      need('preregistration')
      const e = db().expected.find((x) => x.id === id)
      if (!e) fail('error.notFound')
      Object.assign(e as object, { status: 'cancelled' })
      done(undefined)
    },
    async findByRef(ref) {
      refresh()
      const code = ref.trim().toUpperCase().replace(QR_PREREG, '')
      const e = db().expected.find((x) => x.refCode === code)
      return e ? expectedRow(e) : null
    }
  },

  badges: {
    async settings() {
      return { ...db().badge }
    },
    async setSettings(s) {
      admin()
      db().badge = { ...s }
      done(undefined)
    },
    async printers() {
      return ['Demo — badge printer']
    },
    async print(visitId) {
      need('badges')
      const png = await badgePng(visitId, db().badge)
      const w = window.open('', '_blank')
      if (!w) return
      w.document.write(`<title>Badge</title><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#eee"><img src="${png}" style="max-width:90vw;box-shadow:0 2px 12px #0003"><script>setTimeout(()=>print(),300)</script></body>`)
      w.document.close()
    },
    async preview(visitId, s) {
      return badgePng(visitId, { ...db().badge, ...s })
    }
  },

  watchlist: {
    async check(q) {
      return watchHits(q)
    },
    async list(): Promise<WatchRow[]> {
      return db().watch.map((w) => ({ id: w.id, name: w.name, idNumber: w.idNumber, plate: w.plate, reason: w.reason, level: w.level,
        addedBy: w.addedBy, createdAt: w.createdAt, active: w.active }))
    },
    async add(input) {
      admin()
      need('watchlist')
      if (!input.name.trim() && !normId(input.idNumber) && !normPlate(input.plate)) fail('error.watchTarget')
      if (!input.reason.trim()) fail('error.reasonRequired')
      db().watch.push({ id: nextId(), name: input.name.trim(), idNumber: normId(input.idNumber), plate: input.plate.trim().toUpperCase(), reason: input.reason.trim(),
        level: input.level, active: true, addedBy: me().name, createdAt: nowIso() })
      done(undefined)
    },
    async setActive(id, active) {
      admin()
      if (id < 0) fail('error.serverManaged')
      Object.assign(db().watch.find((w) => w.id === id) ?? {}, { active })
      done(undefined)
    }
  }
}

