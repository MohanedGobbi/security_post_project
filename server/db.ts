import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'

let db: DatabaseSync

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','supervisor','host')),
  pass_hash TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_sites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, site_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS enroll_codes (
  code TEXT PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  app_version TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  last_seen TEXT,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS records (
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  entity TEXT NOT NULL,
  local_id INTEGER NOT NULL,
  site_id INTEGER NOT NULL,
  time TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (device_id, entity, local_id)
);
CREATE INDEX IF NOT EXISTS records_site_entity_time ON records(site_id, entity, time);
CREATE TABLE IF NOT EXISTS prereg (
  id INTEGER PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  ref_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  host TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','arrived','cancelled')),
  arrived_at TEXT,
  arrived_device_id INTEGER,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS prereg_site_dates ON prereg(site_id, valid_to);
CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  id_number_enc BLOB,
  plate TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('deny','alert')),
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY,
  time TEXT NOT NULL,
  user_id INTEGER,
  device_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
`

export function openDb(dataDir: string): DatabaseSync {
  db = new DatabaseSync(join(dataDir, 'server.db'))
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA)
  return db
}

export const conn = (): DatabaseSync => db
export const now = (): string => new Date().toISOString()

export function audit(action: string, opts: { userId?: number | null; deviceId?: number | null; detail?: string } = {}): void {
  db.prepare('INSERT INTO audit (time, user_id, device_id, action, detail) VALUES (?, ?, ?, ?, ?)')
    .run(now(), opts.userId ?? null, opts.deviceId ?? null, action, opts.detail ?? '')
}

export function getSetting(key: string, fallback: string): string {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return r?.value ?? fallback
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

/** Records older than the retention period are deleted, with finished pre-registrations and expired sessions. */
export function applyRetention(): number {
  const days = Number(getSetting('retentionDays', '365'))
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()
  const r = db.prepare('DELETE FROM records WHERE time < ?').run(cutoff)
  db.prepare("DELETE FROM prereg WHERE valid_to < ? AND status <> 'pending'").run(cutoff.slice(0, 10))
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now())
  return Number(r.changes)
}
