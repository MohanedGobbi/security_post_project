import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type {
  AuditQuery, AuditRow, CheckInInput, Features, IdType, Lang, NoteCategory, NoteRow, PersonFields, PersonLookup,
  Labels, Level, LevelInput, Permission, Role, SearchQuery, Settings, TodayStats, User, VisitDetail, VisitRow
} from '@shared/types'
import { BUILTIN_LEVELS, PERMISSIONS } from '@shared/permissions'
import { MAX_CARD_PICTURES } from '@shared/types'
import { decryptBuffer, decryptText, encrypt, hashPin, idHash, normalizeId, pinLookup, verifyPin } from './crypto'
import { normalizeFeatures } from '@shared/features'

let db: DatabaseSync

/** leader = head of a guard team; pin_lookup finds a user by PIN alone (see crypto.pinLookup) */
const usersTable = (name: string): string => `CREATE TABLE IF NOT EXISTS ${name} (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  pin_lookup TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);`

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
${usersTable('users')}
/** permission levels: the built-in guard, leader and admin, and the ones an administrator makes */
CREATE TABLE IF NOT EXISTS levels (
  key TEXT PRIMARY KEY,
  labels_json TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  builtin INTEGER NOT NULL DEFAULT 0
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
/** the faculty's students: who they are, to recognise them at the gate and to correct what a card scan misread */
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY,
  student_no_hash TEXT,
  student_no_enc BLOB,
  id_hash TEXT,
  id_number_enc BLOB,
  full_name TEXT NOT NULL,
  full_name_alt TEXT NOT NULL DEFAULT '',
  name_norm TEXT NOT NULL,
  birth_date_enc BLOB,
  phone_enc BLOB,
  level TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS students_no ON students(student_no_hash) WHERE student_no_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS students_idhash ON students(id_hash);
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
/** pictures of the ID card taken by the scanner, encrypted; they go with their visit */
CREATE TABLE IF NOT EXISTS visit_cards (
  id INTEGER PRIMARY KEY,
  visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  image_enc BLOB NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS visit_cards_visit ON visit_cards(visit_id);
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
CREATE TABLE IF NOT EXISTS registers (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  labels_json TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'book',
  fill_roles TEXT NOT NULL,
  close_roles TEXT NOT NULL DEFAULT '',
  close_labels_json TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  opened_at TEXT NOT NULL,
  opened_by INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS register_fields (
  id INTEGER PRIMARY KEY,
  register_id INTEGER NOT NULL REFERENCES registers(id),
  key TEXT NOT NULL,
  labels_json TEXT NOT NULL,
  type TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  required INTEGER NOT NULL DEFAULT 0,
  sensitive INTEGER NOT NULL DEFAULT 0,
  step TEXT NOT NULL DEFAULT 'open',
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (register_id, key)
);
CREATE TABLE IF NOT EXISTS register_entries (
  id INTEGER PRIMARY KEY,
  register_id INTEGER NOT NULL REFERENCES registers(id),
  number INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  data_enc BLOB,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  post TEXT NOT NULL DEFAULT '',
  closed_by INTEGER REFERENCES users(id),
  closed_at TEXT,
  UNIQUE (register_id, number)
);
CREATE INDEX IF NOT EXISTS register_entries_time ON register_entries (register_id, created_at);
CREATE TABLE IF NOT EXISTS register_corrections (
  id INTEGER PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES register_entries(id),
  field_key TEXT NOT NULL,
  change_enc BLOB NOT NULL,
  reason TEXT NOT NULL,
  by_user INTEGER NOT NULL REFERENCES users(id),
  at TEXT NOT NULL
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
  // levels beyond the three first roles: SQLite cannot drop a CHECK constraint, so an older users table is rebuilt (ids kept)
  const users = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get() as { sql: string }
  if (users.sql.includes('CHECK')) {
    const oldCols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name)
    const cols = ['id', 'name', 'role', 'pin_hash', 'pin_lookup', 'language', 'active', 'created_at'].filter((c) => oldCols.includes(c)).join(', ')
    db.exec('PRAGMA foreign_keys = OFF')
    try {
      db.exec(`BEGIN;
        ${usersTable('users_new')}
        INSERT INTO users_new (${cols}) SELECT ${cols} FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
        COMMIT;`)
    } catch (e) {
      try {
        db.exec('ROLLBACK')
      } catch {
        // the transaction never started
      }
      throw e
    } finally {
      db.exec('PRAGMA foreign_keys = ON')
    }
  }
  // how registers look: an accent colour, help text under fields, half-width fields
  if (!hasColumn('registers', 'color')) db.exec("ALTER TABLE registers ADD COLUMN color TEXT NOT NULL DEFAULT ''")
  if (!hasColumn('register_fields', 'hint_json')) db.exec("ALTER TABLE register_fields ADD COLUMN hint_json TEXT NOT NULL DEFAULT ''")
  if (!hasColumn('register_fields', 'half')) db.exec('ALTER TABLE register_fields ADD COLUMN half INTEGER NOT NULL DEFAULT 0')
  // the three built-in levels exist from the start (their names and permissions may have been edited: those are kept)
  const have = new Set((db.prepare('SELECT key FROM levels').all() as { key: string }[]).map((l) => l.key))
  for (const l of BUILTIN_LEVELS) {
    if (!have.has(l.key)) db.prepare('INSERT INTO levels (key, labels_json, permissions, sort, builtin) VALUES (?, ?, ?, ?, 1)').run(l.key, JSON.stringify(l.labels), l.permissions.join(','), l.sort)
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_pin_lookup ON users (pin_lookup) WHERE pin_lookup IS NOT NULL')
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

/**
 * True while the database holds nothing but what the program created at its first start:
 * no visitors, no register entries, no incidents, and no accounts beyond the first two.
 */
export function isFreshInstall(): boolean {
  const n = (table: string): number => {
    try {
      return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
    } catch {
      return 0
    }
  }
  const data = ['persons', 'visits', 'vehicle_logs', 'deliveries', 'incidents', 'register_entries', 'watchlist', 'expected_visits', 'notes', 'shifts']
  return data.every((t) => n(t) === 0) && n('users') <= 2
}

/** Closes the database and deletes its files (a fresh install whose key was lost starts over) */
export function resetDatabase(): void {
  db.close()
  for (const ext of ['', '-wal', '-shm']) rmSync(join(app.getPath('userData'), 'register.db' + ext), { force: true })
}

export function openDb(): void {
  db = new DatabaseSync(join(app.getPath('userData'), 'register.db'))
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA)
  migrate()
}

export function closeDb(): void {
  db.close()
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

/** The audit trail of a period, newest first (at most 5000 lines). */
export function listAudit(q: AuditQuery): AuditRow[] {
  const where = ['a.time BETWEEN ? AND ?']
  const params: (string | number)[] = [dayStart(q.from), dayEnd(q.to)]
  if (q.userId) {
    where.push('a.user_id = ?')
    params.push(q.userId)
  }
  if (q.action) {
    where.push('a.action = ?')
    params.push(q.action)
  }
  const rows = db.prepare(`SELECT a.id, a.time, u.name AS user, a.action, a.entity, a.entity_id, a.detail FROM audit a
    LEFT JOIN users u ON u.id = a.user_id WHERE ${where.join(' AND ')} ORDER BY a.id DESC LIMIT 5000`).all(...params) as {
    id: number; time: string; user: string | null; action: string; entity: string; entity_id: number | null; detail: string
  }[]
  return rows.map((r) => ({ id: r.id, time: r.time, user: r.user, action: r.action, entity: r.entity, entityId: r.entity_id, detail: r.detail }))
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
export interface UserDb { id: number; name: string; role: Role; pin_hash: string; pin_lookup: string | null; language: Lang; active: number }

const toUser = (r: UserDb): User => ({
  id: r.id, name: r.name, role: r.role, permissions: permissionsOf(r.role), language: r.language, active: r.active === 1
})

// ---------- permission levels ----------
const PERMISSION_SET = new Set<string>(PERMISSIONS)
const asPermissions = (s: string): Permission[] => s.split(',').filter((p): p is Permission => PERMISSION_SET.has(p))

/** What a level allows; the administrator level always has everything. */
export function permissionsOf(role: Role): Permission[] {
  if (role === 'admin') return [...PERMISSIONS]
  const r = db.prepare('SELECT permissions FROM levels WHERE key = ?').get(role) as { permissions: string } | undefined
  return r ? asPermissions(r.permissions) : []
}

export function listLevels(): Level[] {
  const rows = db.prepare('SELECT * FROM levels ORDER BY sort, key').all() as { key: string; labels_json: string; permissions: string; builtin: number }[]
  const counts = db.prepare('SELECT role, COUNT(*) AS n FROM users WHERE active = 1 GROUP BY role').all() as { role: string; n: number }[]
  return rows.map((r) => ({
    key: r.key, labels: JSON.parse(r.labels_json) as Labels, builtin: r.builtin === 1, users: counts.find((c) => c.role === r.key)?.n ?? 0,
    permissions: r.key === 'admin' ? [...PERMISSIONS] : asPermissions(r.permissions)
  }))
}

export const levelExists = (key: string): boolean => !!db.prepare('SELECT key FROM levels WHERE key = ?').get(key)

/** Creates a level (no key) or changes one: its names and permissions. The administrator level is fixed. */
export function saveLevel(input: LevelInput): Role {
  const name = (s: unknown): string => String(s ?? '').trim().slice(0, 60)
  const labels: Labels = { ar: name(input.labels?.ar), en: name(input.labels?.en), fr: name(input.labels?.fr) }
  if (!labels.ar && !labels.en && !labels.fr) throw new Error('error.nameRequired')
  const perms = [...new Set((input.permissions ?? []).filter((p) => PERMISSION_SET.has(p)))].join(',')
  if (input.key) {
    if (input.key === 'admin') throw new Error('error.forbidden')
    if (!levelExists(input.key)) throw new Error('error.notFound')
    db.prepare('UPDATE levels SET labels_json = ?, permissions = ? WHERE key = ?').run(JSON.stringify(labels), perms, input.key)
    return input.key
  }
  const key = 'level_' + Date.now().toString(36)
  const sort = (db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM levels').get() as { n: number }).n
  db.prepare('INSERT INTO levels (key, labels_json, permissions, sort, builtin) VALUES (?, ?, ?, ?, 0)').run(key, JSON.stringify(labels), perms, sort)
  return key
}

/** A level of your own, when no account is at it. */
export function deleteLevel(key: Role): void {
  const row = db.prepare('SELECT builtin FROM levels WHERE key = ?').get(key) as { builtin: number } | undefined
  if (!row) throw new Error('error.notFound')
  if (row.builtin === 1) throw new Error('error.forbidden')
  if ((db.prepare('SELECT COUNT(*) AS n FROM users WHERE role = ?').get(key) as { n: number }).n > 0) throw new Error('error.levelInUse')
  db.prepare('DELETE FROM levels WHERE key = ?').run(key)
}

export function userCount(): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
}

/**
 * The account owning this PIN (active or not). Accounts made before PIN lookups existed are checked
 * against their scrypt hash one by one, and get their lookup on the first match.
 */
export function findUserByPin(pin: string): UserDb | undefined {
  const lookup = pinLookup(pin)
  const hit = db.prepare('SELECT * FROM users WHERE pin_lookup = ?').get(lookup) as UserDb | undefined
  if (hit) return hit
  const legacy = db.prepare('SELECT * FROM users WHERE pin_lookup IS NULL').all() as unknown as UserDb[]
  const match = legacy.find((u) => verifyPin(pin, u.pin_hash))
  if (match) db.prepare('UPDATE users SET pin_lookup = ? WHERE id = ?').run(lookup, match.id)
  return match
}

/** Each PIN belongs to one person, so that the PIN alone can say who is logging in. */
function assertPinFree(pin: string, userId: number | null): void {
  const owner = findUserByPin(pin)
  if (owner && owner.id !== userId) throw new Error('error.pinTaken')
}

export function createUser(name: string, role: Role, pin: string, language: Lang): number {
  assertPinFree(pin, null)
  const r = db.prepare('INSERT INTO users (name, role, pin_hash, pin_lookup, language, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name.trim(), role, hashPin(pin), pinLookup(pin), language, now())
  return Number(r.lastInsertRowid)
}

export function getUserRow(id: number): UserDb | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserDb | undefined
}

export function getUser(id: number): User | null {
  const r = getUserRow(id)
  return r ? toUser(r) : null
}

/** Accounts that still have one of the starting PINs (compared by the PIN fingerprint: cheap, no hashing of each account) */
export function usersWithDefaultPin(pins: readonly string[]): Set<number> {
  const lookups = pins.map((p) => pinLookup(p))
  const rows = db.prepare('SELECT id, pin_lookup FROM users').all() as { id: number; pin_lookup: string | null }[]
  return new Set(rows.filter((r) => r.pin_lookup && lookups.includes(r.pin_lookup)).map((r) => r.id))
}

export function listUsers(activeOnly: boolean): User[] {
  const rows = db.prepare(`SELECT * FROM users ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY name`).all() as unknown as UserDb[]
  return rows.map(toUser)
}

export function updateUser(id: number, patch: { active?: boolean; pin?: string; role?: Role; language?: Lang }): void {
  if (patch.active !== undefined) db.prepare('UPDATE users SET active = ? WHERE id = ?').run(patch.active ? 1 : 0, id)
  if (patch.pin) {
    assertPinFree(patch.pin, id)
    db.prepare('UPDATE users SET pin_hash = ?, pin_lookup = ? WHERE id = ?').run(hashPin(patch.pin), pinLookup(patch.pin), id)
  }
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
const MAX_CARD_BYTES = 4 * 1024 * 1024

/** The card pictures of an entry: JPEG only, a few of them, none too large (anything else is dropped) */
function cleanCards(cards: Uint8Array[] | undefined): Uint8Array[] {
  return (Array.isArray(cards) ? cards : [])
    .filter((c) => c instanceof Uint8Array && c.length > 100 && c.length <= MAX_CARD_BYTES && c[0] === 0xff && c[1] === 0xd8)
    .slice(0, MAX_CARD_PICTURES)
}

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
    for (const card of cleanCards(input.cards)) {
      db.prepare('INSERT INTO visit_cards (visit_id, image_enc, created_at) VALUES (?, ?, ?)').run(visitId, encrypt(Buffer.from(card)), time)
    }
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
  gi.name AS guard_in_name, go.name AS guard_out_name, (v.photo_enc IS NOT NULL) AS has_photo, v.custom_json,
  (SELECT COUNT(*) FROM visit_cards c WHERE c.visit_id = v.id) AS card_count
FROM visits v
JOIN persons p ON p.id = v.person_id
JOIN users gi ON gi.id = v.guard_in
LEFT JOIN users go ON go.id = v.guard_out`

interface VisitDb {
  id: number; person_id: number; full_name: string; full_name_alt: string; id_type: IdType; id_number_enc: Uint8Array
  company: string; nationality: string; birth_date_enc: Uint8Array | null; sex: string; phone_enc: Uint8Array | null
  host: string; purpose: string; badge_no: string; vehicle_plate: string; notes: string; time_in: string
  time_out: string | null; guard_in_name: string; guard_out_name: string | null; has_photo: number; custom_json: string; card_count: number
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
  cardCount: r.card_count,
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
    photo: buf ? new Uint8Array(buf) : null,
    cards: (db.prepare('SELECT image_enc FROM visit_cards WHERE visit_id = ? ORDER BY id').all(visitId) as { image_enc: Uint8Array }[])
      .map((c) => decryptBuffer(c.image_enc))
      .filter((b): b is Buffer => !!b)
      .map((b) => new Uint8Array(b))
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
