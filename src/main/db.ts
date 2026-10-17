import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { app } from 'electron'
import type {
  CheckInInput, Features, IdType, Lang, NoteCategory, NoteRow, PersonFields, PersonLookup,
  Role, SearchQuery, Settings, TodayStats, User, VisitDetail, VisitRow
} from '@shared/types'
import { decryptBuffer, decryptText, encrypt, hashPin, idHash, normalizeId } from './crypto'
import { normalizeFeatures } from '@shared/features'

let db: DatabaseSync

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','guard')),
  pin_hash TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS persons (
  id INTEGER PRIMARY KEY,
  id_hash TEXT NOT NULL UNIQUE,
  id_type TEXT NOT NULL,
  id_number_enc BLOB NOT NULL,
  full_name TEXT NOT NULL,
  full_name_alt TEXT NOT NULL DEFAULT '',
  nationality TEXT NOT NULL DEFAULT '',
  birth_date_enc BLOB,
  sex TEXT NOT NULL DEFAULT '',
  phone_enc BLOB,
  company TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  last_seen TEXT
);
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  time_in TEXT NOT NULL,
  time_out TEXT,
  host TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  badge_no TEXT NOT NULL DEFAULT '',
  vehicle_plate TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  photo_enc BLOB,
  guard_in INTEGER NOT NULL REFERENCES users(id),
  guard_out INTEGER REFERENCES users(id),
  post TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS visits_time_in ON visits(time_in);
CREATE INDEX IF NOT EXISTS visits_inside ON visits(time_out) WHERE time_out IS NULL;
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  time TEXT NOT NULL,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  guard_id INTEGER NOT NULL REFERENCES users(id),
  post TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS notes_time ON notes(time);
CREATE TABLE IF NOT EXISTS vehicle_logs (
  id INTEGER PRIMARY KEY,
  plate TEXT NOT NULL,
  plate_norm TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'car',
  color TEXT NOT NULL DEFAULT '',
  driver_name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  passengers INTEGER NOT NULL DEFAULT 0,
  cargo TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  photo_enc BLOB,
  visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL,
  time_in TEXT NOT NULL,
  time_out TEXT,
  guard_in INTEGER NOT NULL REFERENCES users(id),
  guard_out INTEGER REFERENCES users(id),
  post TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS vehicle_time_in ON vehicle_logs(time_in);
CREATE INDEX IF NOT EXISTS vehicle_plate ON vehicle_logs(plate_norm);
CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY,
  time TEXT NOT NULL,
  carrier TEXT NOT NULL DEFAULT '',
  courier_name TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL,
  parcels INTEGER NOT NULL DEFAULT 1,
  tracking TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  photo_enc BLOB,
  guard_id INTEGER NOT NULL REFERENCES users(id),
  picked_up_at TEXT,
  picked_up_by TEXT NOT NULL DEFAULT '',
  guard_pickup INTEGER REFERENCES users(id),
  post TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS deliveries_time ON deliveries(time);
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  people_involved TEXT NOT NULL DEFAULT '',
  action_taken TEXT NOT NULL DEFAULT '',
  guard_id INTEGER NOT NULL REFERENCES users(id),
  closed_at TEXT,
  closed_by INTEGER REFERENCES users(id),
  resolution TEXT NOT NULL DEFAULT '',
  post TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS incidents_time ON incidents(occurred_at);
CREATE TABLE IF NOT EXISTS incident_photos (
  id INTEGER PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  photo_enc BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  post TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  handover_note TEXT NOT NULL DEFAULT '',
  acknowledged_by INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS shifts_started ON shifts(started_at);
CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  name_norm TEXT NOT NULL DEFAULT '',
  id_hash TEXT,
  id_number_enc BLOB,
  plate_norm TEXT NOT NULL DEFAULT '',
  plate TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('deny','alert')),
  added_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS custom_fields (
  id INTEGER PRIMARY KEY,
  entity TEXT NOT NULL CHECK (entity IN ('visit','vehicle','delivery')),
  labels_json TEXT NOT NULL,
  type TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  required INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS checkpoints (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS patrol_rounds (
  id INTEGER PRIMARY KEY,
  guard_id INTEGER NOT NULL REFERENCES users(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  note TEXT NOT NULL DEFAULT '',
  post TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS patrol_started ON patrol_rounds(started_at);
CREATE TABLE IF NOT EXISTS patrol_checks (
  id INTEGER PRIMARY KEY,
  round_id INTEGER NOT NULL REFERENCES patrol_rounds(id) ON DELETE CASCADE,
  checkpoint_id INTEGER NOT NULL REFERENCES checkpoints(id),
  time TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok','issue')),
  note TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT 'manual',
  UNIQUE (round_id, checkpoint_id)
);
CREATE TABLE IF NOT EXISTS key_items (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'key',
  code TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS key_loans (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES key_items(id),
  borrower TEXT NOT NULL,
  borrower_info TEXT NOT NULL DEFAULT '',
  out_at TEXT NOT NULL,
  due_at TEXT,
  returned_at TEXT,
  guard_out INTEGER NOT NULL REFERENCES users(id),
  guard_in INTEGER REFERENCES users(id),
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS key_loans_out ON key_loans(out_at);
CREATE TABLE IF NOT EXISTS expected_visits (
  id INTEGER PRIMARY KEY,
  server_id INTEGER UNIQUE,
  ref_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  host TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  arrived_at TEXT,
  visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL,
  arrival_synced INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS expected_dates ON expected_visits(valid_to);
CREATE TABLE IF NOT EXISTS server_watchlist (
  server_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  name_norm TEXT NOT NULL DEFAULT '',
  id_hash TEXT,
  id_number_enc BLOB,
  plate TEXT NOT NULL DEFAULT '',
  plate_norm TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  level TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_state (
  entity TEXT NOT NULL,
  local_id INTEGER NOT NULL,
  hash TEXT NOT NULL,
  PRIMARY KEY (entity, local_id)
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY,
  time TEXT NOT NULL,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT NOT NULL DEFAULT '',
  entity_id INTEGER,
  detail TEXT NOT NULL DEFAULT ''
);
`

/** Columns added after the first release, for databases created by an older version. */
function migrate(): void {
  const hasColumn = (table: string, col: string): boolean =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === col)
  for (const table of ['visits', 'vehicle_logs', 'deliveries']) {
    if (!hasColumn(table, 'custom_json')) db.exec(`ALTER TABLE ${table} ADD COLUMN custom_json TEXT NOT NULL DEFAULT '{}'`)
  }
}

/** Custom field values are stored as JSON next to the record */
export const parseCustom = (json: string | null | undefined): Record<string, string> => {
  try {
    const v = JSON.parse(json || '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

export function openDb(): void {
  db = new DatabaseSync(join(app.getPath('userData'), 'register.db'))
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA)
  migrate()
}

/** The open connection, for the other data modules (vehicles, deliveries, …). */
export const conn = (): DatabaseSync => db

export const now = (): string => new Date().toISOString()
/** Local calendar day -> UTC ISO bounds */
export const dayStart = (d: string): string => new Date(`${d}T00:00:00`).toISOString()
export const dayEnd = (d: string): string => new Date(`${d}T23:59:59.999`).toISOString()
/** Plates are compared without spaces / dashes and in upper case */
export const normPlate = (p: string): string => p.toUpperCase().replace(/[\s\-.·]/g, '')
export const todayLocal = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------- audit ----------
export function audit(userId: number | null, action: string, entity = '', entityId: number | null = null, detail = ''): void {
  db.prepare('INSERT INTO audit (time, user_id, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?)')
    .run(now(), userId, action, entity, entityId, detail)
}

// ---------- settings ----------
const DEFAULT_SETTINGS: Settings = {
  siteName: '', postName: '', retentionDays: 365, overstayHours: 8, closingTime: '', vehicleOverstayHours: 0, patrolIntervalHours: 0
}

export function getSettings(): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    siteName: map.siteName ?? DEFAULT_SETTINGS.siteName,
    postName: map.postName ?? DEFAULT_SETTINGS.postName,
    retentionDays: Number(map.retentionDays ?? DEFAULT_SETTINGS.retentionDays),
    overstayHours: Number(map.overstayHours ?? DEFAULT_SETTINGS.overstayHours),
    closingTime: map.closingTime ?? DEFAULT_SETTINGS.closingTime,
    vehicleOverstayHours: Number(map.vehicleOverstayHours ?? DEFAULT_SETTINGS.vehicleOverstayHours),
    patrolIntervalHours: Number(map.patrolIntervalHours ?? DEFAULT_SETTINGS.patrolIntervalHours)
  }
}

// ---------- feature switches ----------
export function getFeatures(): Features {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'features'").get() as { value: string } | undefined
  let stored: Partial<Features> | null = null
  try {
    stored = row ? (JSON.parse(row.value) as Partial<Features>) : null
  } catch {
    stored = null
  }
  return normalizeFeatures(stored)
}

export function setFeatures(f: Features): void {
  db.prepare("INSERT INTO settings (key, value) VALUES ('features', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(normalizeFeatures(f)))
}

export function setSettings(s: Settings): void {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  stmt.run('siteName', s.siteName.trim())
  stmt.run('postName', s.postName.trim())
  stmt.run('retentionDays', String(Math.max(1, Math.round(s.retentionDays))))
  const hours = (n: number): string => String(Math.max(0, Math.min(240, Number(n) || 0)))
  stmt.run('overstayHours', hours(s.overstayHours))
  stmt.run('vehicleOverstayHours', hours(s.vehicleOverstayHours))
  stmt.run('patrolIntervalHours', hours(s.patrolIntervalHours))
  stmt.run('closingTime', /^([01]\d|2[0-3]):[0-5]\d$/.test(s.closingTime ?? '') ? s.closingTime : '')
}

// ---------- users ----------
interface UserDb { id: number; name: string; role: Role; pin_hash: string; language: Lang; active: number }

const toUser = (r: UserDb): User => ({ id: r.id, name: r.name, role: r.role, language: r.language, active: r.active === 1 })

export function userCount(): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
}

export function createUser(name: string, role: Role, pin: string, language: Lang): number {
  const r = db.prepare('INSERT INTO users (name, role, pin_hash, language, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(name.trim(), role, hashPin(pin), language, now())
  return Number(r.lastInsertRowid)
}

export function getUserRow(id: number): UserDb | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserDb | undefined
}

export function getUser(id: number): User | null {
  const r = getUserRow(id)
  return r ? toUser(r) : null
}

export function listUsers(activeOnly: boolean): User[] {
  const rows = db.prepare(`SELECT * FROM users ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY name`).all() as unknown as UserDb[]
  return rows.map(toUser)
}

export function updateUser(id: number, patch: { active?: boolean; pin?: string; role?: Role; language?: Lang }): void {
  if (patch.active !== undefined) db.prepare('UPDATE users SET active = ? WHERE id = ?').run(patch.active ? 1 : 0, id)
  if (patch.pin) db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(patch.pin), id)
  if (patch.role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(patch.role, id)
  if (patch.language) db.prepare('UPDATE users SET language = ? WHERE id = ?').run(patch.language, id)
}

export function activeAdminCount(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get() as { n: number }).n
}

// ---------- persons ----------
interface PersonDb {
  id: number; id_type: IdType; id_number_enc: Uint8Array; full_name: string; full_name_alt: string
  nationality: string; birth_date_enc: Uint8Array | null; sex: string; phone_enc: Uint8Array | null
  company: string; last_seen: string | null
}

const personFields = (p: PersonDb): PersonFields => ({
  fullName: p.full_name,
  fullNameAlt: p.full_name_alt,
  idType: p.id_type,
  idNumber: decryptText(p.id_number_enc),
  nationality: p.nationality,
  birthDate: decryptText(p.birth_date_enc),
  sex: p.sex,
  phone: decryptText(p.phone_enc),
  company: p.company
})

export function lookupPerson(idNumber: string): PersonLookup | null {
  if (!normalizeId(idNumber)) return null
  const p = db.prepare('SELECT * FROM persons WHERE id_hash = ?').get(idHash(idNumber)) as PersonDb | undefined
  if (!p) return null
  const stats = db.prepare('SELECT COUNT(*) AS n FROM visits WHERE person_id = ?').get(p.id) as { n: number }
  const inside = db.prepare('SELECT id FROM visits WHERE person_id = ? AND time_out IS NULL ORDER BY time_in DESC LIMIT 1').get(p.id) as { id: number } | undefined
  const last = db.prepare('SELECT host, purpose FROM visits WHERE person_id = ? ORDER BY time_in DESC LIMIT 1').get(p.id) as { host: string; purpose: string } | undefined
  return {
    personId: p.id,
    fields: personFields(p),
    visitsCount: stats.n,
    lastSeen: p.last_seen,
    insideVisitId: inside?.id ?? null,
    lastHost: last?.host ?? '',
    lastPurpose: last?.purpose ?? ''
  }
}

function upsertPerson(input: PersonFields): number {
  if (!normalizeId(input.idNumber)) {
    const r = db.prepare(`INSERT INTO persons (id_type, id_number_enc, full_name, full_name_alt, nationality, birth_date_enc, sex, phone_enc,
      company, last_seen, id_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      input.idType, new Uint8Array(0), input.fullName.trim(), input.fullNameAlt.trim(), input.nationality.trim(), encrypt(input.birthDate.trim()),
      input.sex.trim(), encrypt(input.phone.trim()), input.company.trim(), now(), `noid:${randomUUID()}`, now()
    )
    return Number(r.lastInsertRowid)
  }
  const hash = idHash(input.idNumber)
  const existing = db.prepare('SELECT * FROM persons WHERE id_hash = ?').get(hash) as PersonDb | undefined
  // Returning visitor: a blank field in the form keeps what we already know
  const f: PersonFields = { ...input }
  if (existing) {
    const old = personFields(existing)
    for (const k of Object.keys(f) as (keyof PersonFields)[]) {
      if (k !== 'idType' && !String(f[k]).trim()) (f as unknown as Record<string, string>)[k] = old[k]
    }
  }
  const values = [
    f.idType, encrypt(normalizeId(f.idNumber)), f.fullName.trim(), f.fullNameAlt.trim(), f.nationality.trim(),
    encrypt(f.birthDate.trim()), f.sex.trim(), encrypt(f.phone.trim()), f.company.trim(), now()
  ]
  if (existing) {
    db.prepare(`UPDATE persons SET id_type = ?, id_number_enc = ?, full_name = ?, full_name_alt = ?, nationality = ?,
      birth_date_enc = ?, sex = ?, phone_enc = ?, company = ?, last_seen = ? WHERE id = ?`).run(...values, existing.id)
    return existing.id
  }
  const r = db.prepare(`INSERT INTO persons (id_type, id_number_enc, full_name, full_name_alt, nationality, birth_date_enc,
    sex, phone_enc, company, last_seen, id_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...values, hash, now())
  return Number(r.lastInsertRowid)
}

// ---------- visits ----------
export function checkIn(input: CheckInInput, guardId: number, post: string): number {
  if (!input.fullName.trim()) throw new Error('error.nameRequired')
  if (!normalizeId(input.idNumber) && getFeatures().requireIdNumber) throw new Error('error.idRequired')
  db.exec('BEGIN')
  try {
    const personId = upsertPerson(input)
    const time = now()
    const plate = input.vehiclePlate.trim().toUpperCase()
    const r = db.prepare(`INSERT INTO visits (person_id, time_in, host, purpose, badge_no, vehicle_plate, notes, photo_enc, guard_in, post, custom_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      personId, time, input.host.trim(), input.purpose.trim(), input.badgeNo.trim(),
      plate, input.notes.trim(), input.photo ? encrypt(Buffer.from(input.photo)) : null, guardId, post, JSON.stringify(input.custom ?? {})
    )
    const visitId = Number(r.lastInsertRowid)
    // a visitor who drives in also gets a vehicle entry, released when they check out
    if (normPlate(plate)) {
      db.prepare(`INSERT INTO vehicle_logs (plate, plate_norm, driver_name, company, visit_id, time_in, guard_in, post)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(plate, normPlate(plate), input.fullName.trim(), input.company.trim(), visitId, time, guardId, post)
    }
    db.exec('COMMIT')
    return visitId
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function checkOut(visitId: number, guardId: number, note: string): void {
  const v = db.prepare('SELECT notes, time_out FROM visits WHERE id = ?').get(visitId) as { notes: string; time_out: string | null } | undefined
  if (!v) throw new Error('error.notFound')
  if (v.time_out) throw new Error('error.alreadyOut')
  const notes = note.trim() ? [v.notes, note.trim()].filter(Boolean).join(' | ') : v.notes
  const time = now()
  db.prepare('UPDATE visits SET time_out = ?, guard_out = ?, notes = ? WHERE id = ?').run(time, guardId, notes, visitId)
  db.prepare('UPDATE vehicle_logs SET time_out = ?, guard_out = ? WHERE visit_id = ? AND time_out IS NULL').run(time, guardId, visitId)
}

const VISIT_SELECT = `
SELECT v.id, v.person_id, p.full_name, p.full_name_alt, p.id_type, p.id_number_enc, p.company, p.nationality,
  p.birth_date_enc, p.sex, p.phone_enc, v.host, v.purpose, v.badge_no, v.vehicle_plate, v.notes, v.time_in, v.time_out,
  gi.name AS guard_in_name, go.name AS guard_out_name, (v.photo_enc IS NOT NULL) AS has_photo, v.custom_json
FROM visits v
JOIN persons p ON p.id = v.person_id
JOIN users gi ON gi.id = v.guard_in
LEFT JOIN users go ON go.id = v.guard_out`

interface VisitDb {
  id: number; person_id: number; full_name: string; full_name_alt: string; id_type: IdType; id_number_enc: Uint8Array
  company: string; nationality: string; birth_date_enc: Uint8Array | null; sex: string; phone_enc: Uint8Array | null
  host: string; purpose: string; badge_no: string; vehicle_plate: string; notes: string; time_in: string
  time_out: string | null; guard_in_name: string; guard_out_name: string | null; has_photo: number; custom_json: string
}

const toVisitRow = (r: VisitDb): VisitRow => ({
  id: r.id,
  personId: r.person_id,
  fullName: r.full_name,
  fullNameAlt: r.full_name_alt,
  idType: r.id_type,
  idNumber: decryptText(r.id_number_enc),
  company: r.company,
  host: r.host,
  purpose: r.purpose,
  badgeNo: r.badge_no,
  vehiclePlate: r.vehicle_plate,
  notes: r.notes,
  timeIn: r.time_in,
  timeOut: r.time_out,
  guardIn: r.guard_in_name,
  guardOut: r.guard_out_name,
  hasPhoto: r.has_photo === 1,
  custom: parseCustom(r.custom_json)
})

export function insideNow(): VisitRow[] {
  return (db.prepare(`${VISIT_SELECT} WHERE v.time_out IS NULL ORDER BY v.time_in DESC`).all() as unknown as VisitDb[]).map(toVisitRow)
}

export function searchVisits(q: SearchQuery): VisitRow[] {
  const where = ['v.time_in BETWEEN ? AND ?']
  const params: (string | number)[] = [dayStart(q.from), dayEnd(q.to)]
  if (q.status === 'inside') where.push('v.time_out IS NULL')
  if (q.status === 'left') where.push('v.time_out IS NOT NULL')
  const text = q.text.trim()
  if (text) {
    // ID numbers are encrypted: match them through their keyed hash, everything else by substring
    const like = `%${text}%`
    where.push(`(p.full_name LIKE ? OR p.full_name_alt LIKE ? OR p.company LIKE ? OR v.host LIKE ? OR v.purpose LIKE ?
      OR v.badge_no LIKE ? OR v.vehicle_plate LIKE ? OR v.notes LIKE ? OR v.custom_json LIKE ? OR p.id_hash = ?)`)
    params.push(like, like, like, like, like, like, like, like, like, idHash(text))
  }
  const sql = `${VISIT_SELECT} WHERE ${where.join(' AND ')} ORDER BY v.time_in DESC LIMIT 5000`
  return (db.prepare(sql).all(...params) as unknown as VisitDb[]).map(toVisitRow)
}

export function getVisit(visitId: number): VisitDetail {
  const r = db.prepare(`${VISIT_SELECT} WHERE v.id = ?`).get(visitId) as VisitDb | undefined
  if (!r) throw new Error('error.notFound')
  const photo = db.prepare('SELECT photo_enc FROM visits WHERE id = ?').get(visitId) as { photo_enc: Uint8Array | null }
  const buf = decryptBuffer(photo.photo_enc)
  return {
    ...toVisitRow(r),
    nationality: r.nationality,
    birthDate: decryptText(r.birth_date_enc),
    sex: r.sex,
    phone: decryptText(r.phone_enc),
    photo: buf ? new Uint8Array(buf) : null
  }
}

export function todayStats(): TodayStats {
  const t = todayLocal()
  const [a, b] = [dayStart(t), dayEnd(t)]
  const one = (sql: string, ...p: string[]): number => (db.prepare(sql).get(...p) as { n: number }).n
  return {
    inside: one('SELECT COUNT(*) AS n FROM visits WHERE time_out IS NULL'),
    inToday: one('SELECT COUNT(*) AS n FROM visits WHERE time_in BETWEEN ? AND ?', a, b),
    outToday: one('SELECT COUNT(*) AS n FROM visits WHERE time_out BETWEEN ? AND ?', a, b),
    notesToday: one('SELECT COUNT(*) AS n FROM notes WHERE time BETWEEN ? AND ?', a, b),
    vehiclesInside: one('SELECT COUNT(*) AS n FROM vehicle_logs WHERE time_out IS NULL'),
    parcelsWaiting: one('SELECT COALESCE(SUM(parcels), 0) AS n FROM deliveries WHERE picked_up_at IS NULL'),
    openIncidents: one('SELECT COUNT(*) AS n FROM incidents WHERE closed_at IS NULL')
  }
}

/** Most used hosts / purposes over the last 90 days, for quick-pick chips in the form */
export function suggestions(): { hosts: string[]; purposes: string[] } {
  const since = new Date(Date.now() - 90 * 86400000).toISOString()
  const top = (col: string): string[] =>
    (db.prepare(`SELECT ${col} AS v, COUNT(*) AS n FROM visits WHERE time_in > ? AND ${col} <> '' GROUP BY ${col} ORDER BY n DESC LIMIT 8`)
      .all(since) as { v: string }[]).map((r) => r.v)
  return { hosts: top('host'), purposes: top('purpose') }
}

// ---------- notes ----------
export function addNote(category: NoteCategory, text: string, guardId: number, post: string): number {
  if (!text.trim()) throw new Error('error.textRequired')
  const r = db.prepare('INSERT INTO notes (time, category, text, guard_id, post) VALUES (?, ?, ?, ?, ?)').run(now(), category, text.trim(), guardId, post)
  return Number(r.lastInsertRowid)
}

export function listNotes(from: string, to: string): NoteRow[] {
  return db.prepare(`SELECT n.id, n.time, n.category, n.text, u.name AS guard FROM notes n JOIN users u ON u.id = n.guard_id
    WHERE n.time BETWEEN ? AND ? ORDER BY n.time DESC`).all(dayStart(from), dayEnd(to)) as unknown as NoteRow[]
}

// ---------- retention ----------
/** Deletes visits / notes older than the retention period and people with no remaining visits. */
export function applyRetention(): Record<string, number> {
  const cutoff = new Date(Date.now() - getSettings().retentionDays * 86400000).toISOString()
  const del = (sql: string): number => Number(db.prepare(sql).run(cutoff).changes)
  // open items (people/vehicles inside, parcels waiting, open incidents) are never purged
  const out = {
    visits: del('DELETE FROM visits WHERE time_out IS NOT NULL AND time_out < ?'),
    vehicles: del('DELETE FROM vehicle_logs WHERE time_out IS NOT NULL AND time_out < ?'),
    deliveries: del('DELETE FROM deliveries WHERE picked_up_at IS NOT NULL AND picked_up_at < ?'),
    incidents: del('DELETE FROM incidents WHERE closed_at IS NOT NULL AND closed_at < ?'),
    notes: del('DELETE FROM notes WHERE time < ?'),
    shifts: del('DELETE FROM shifts WHERE ended_at IS NOT NULL AND ended_at < ?'),
    patrols: del('DELETE FROM patrol_rounds WHERE ended_at IS NOT NULL AND ended_at < ?'),
    keyLoans: del('DELETE FROM key_loans WHERE returned_at IS NOT NULL AND returned_at < ?'),
    expected: del('DELETE FROM expected_visits WHERE valid_to < substr(?, 1, 10)')
  }
  const persons = Number(db.prepare('DELETE FROM persons WHERE id NOT IN (SELECT DISTINCT person_id FROM visits)').run().changes)
  return { ...out, persons }
}
