import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import type { BackupInfo, SafetyCopy } from '@shared/types'
import { closeDb, conn, now } from './db'
import { exportDataKey, installDataKey } from './crypto'

/**
 * Backups, restores and resets of the database.
 *
 * Two kinds of copies:
 *  - safety copies, made by the program itself (every day, and before anything that erases): a folder with the database and
 *    its key file, kept here on this PC under the same Windows account, restored without a password;
 *  - a portable backup file (.secbak) the administrator makes by hand: the database and its encryption key inside one file
 *    protected by a password the administrator chooses, so it can be kept on a USB drive and restored on another PC.
 * The encryption key is tied to the Windows account (Windows DPAPI), so a copy of the database alone would be unreadable elsewhere.
 */

const MAGIC = Buffer.from('SECBAK01')
const AUTO_KEPT = 14
const OTHER_KEPT = 10

export const backupsDir = (): string => join(app.getPath('userData'), 'backups')
const keyFile = (): string => join(app.getPath('userData'), 'data.key')
const dbFile = (): string => join(app.getPath('userData'), 'register.db')

/** a consistent copy of the open database into a new file (also holds what is still in the write-ahead log) */
function snapshotTo(file: string): void {
  rmSync(file, { force: true })
  conn().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`)
}

const stamp = (d = new Date()): string =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`

export type CopyKind = 'auto' | 'before-restore' | 'before-erase' | 'before-reset' | 'before-delete'

/** Folder `<kind>-<time>` with register.db and data.key. Returns its name. */
export function makeSafetyCopy(kind: CopyKind): string {
  const name = `${kind}-${stamp()}`
  const dir = join(backupsDir(), name)
  mkdirSync(dir, { recursive: true })
  snapshotTo(join(dir, 'register.db'))
  if (existsSync(keyFile())) copyFileSync(keyFile(), join(dir, 'data.key'))
  pruneSafetyCopies()
  return name
}

export function listSafetyCopies(): SafetyCopy[] {
  if (!existsSync(backupsDir())) return []
  return readdirSync(backupsDir(), { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(backupsDir(), e.name, 'register.db')))
    .map((e) => {
      const kind = e.name.replace(/-\d{8}-\d{6}$/, '')
      const st = statSync(join(backupsDir(), e.name, 'register.db'))
      return { name: e.name, kind, time: st.mtime.toISOString(), bytes: st.size }
    })
    .sort((a, b) => b.time.localeCompare(a.time))
}

function pruneSafetyCopies(): void {
  const all = listSafetyCopies()
  const drop = [...all.filter((c) => c.kind === 'auto').slice(AUTO_KEPT), ...all.filter((c) => c.kind !== 'auto').slice(OTHER_KEPT)]
  for (const c of drop) rmSync(join(backupsDir(), c.name), { recursive: true, force: true })
}

/** A safety copy once a day: at the start of the program when the last one is older than 20 hours. */
export function autoSafetyCopy(): void {
  try {
    const last = listSafetyCopies().find((c) => c.kind === 'auto')
    if (!last || Date.now() - Date.parse(last.time) > 20 * 3600000) makeSafetyCopy('auto')
  } catch {
    // a failed safety copy must never stop the program from starting
  }
}

export function backupInfo(): BackupInfo {
  const st = existsSync(dbFile()) ? statSync(dbFile()) : null
  const last = conn().prepare("SELECT value FROM settings WHERE key = 'lastPortableBackup'").get() as { value: string } | undefined
  return { dataDir: app.getPath('userData'), backupsDir: backupsDir(), dbBytes: st?.size ?? 0, copies: listSafetyCopies(), lastBackup: last?.value ?? null }
}

// ---------- the portable backup file ----------
const derive = (password: string, salt: Buffer): Buffer => scryptSync(password, salt, 32)

export function writePortableBackup(file: string, password: string): void {
  if (password.length < 6) throw new Error('error.backupPasswordShort')
  const tmp = join(app.getPath('temp'), `secbak-${Date.now()}.db`)
  try {
    snapshotTo(tmp)
    const header = Buffer.from(JSON.stringify({ v: 1, app: 'FacultySecurity', created: now(), dataKey: exportDataKey().toString('base64') }), 'utf8')
    const len = Buffer.alloc(4)
    len.writeUInt32BE(header.length)
    const plain = Buffer.concat([len, header, readFileSync(tmp)])
    const salt = randomBytes(16)
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', derive(password, salt), iv)
    const body = Buffer.concat([cipher.update(plain), cipher.final()])
    writeFileSync(file, Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]))
    conn().prepare("INSERT INTO settings (key, value) VALUES ('lastPortableBackup', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(now())
  } finally {
    rmSync(tmp, { force: true })
  }
}

export function readPortableBackup(file: string, password: string): { db: Buffer; dataKey: Buffer } {
  const raw = readFileSync(file)
  if (raw.length < 60 || !raw.subarray(0, 8).equals(MAGIC)) throw new Error('error.backupFile')
  const salt = raw.subarray(8, 24)
  const iv = raw.subarray(24, 36)
  const tag = raw.subarray(36, 52)
  let plain: Buffer
  try {
    const d = createDecipheriv('aes-256-gcm', derive(password, salt), iv)
    d.setAuthTag(tag)
    plain = Buffer.concat([d.update(raw.subarray(52)), d.final()])
  } catch {
    throw new Error('error.backupPassword')
  }
  const hl = plain.readUInt32BE(0)
  const header = JSON.parse(plain.subarray(4, 4 + hl).toString('utf8')) as { dataKey: string }
  return { db: plain.subarray(4 + hl), dataKey: Buffer.from(header.dataKey, 'base64') }
}

// ---------- replacing the database ----------
/** Is this file a database of this program? (opened on its own, nothing replaced yet) */
function assertProgramDatabase(file: string): void {
  let probe: DatabaseSync | null = null
  try {
    probe = new DatabaseSync(file)
    const ok = probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'settings')").all().length === 2
    if (!ok) throw new Error('x')
  } catch {
    throw new Error('error.backupFile')
  } finally {
    probe?.close()
  }
}

function relaunch(): void {
  app.relaunch()
  app.exit(0)
}

/** Puts a database (and, when given, its key) in place of the current one, then restarts the program. */
export function installDatabase(db: Buffer, dataKey: Buffer | null): void {
  const probe = join(app.getPath('temp'), `secbak-check-${Date.now()}.db`)
  writeFileSync(probe, db)
  try {
    assertProgramDatabase(probe)
  } catch (e) {
    rmSync(probe, { force: true })
    throw e
  }
  closeDb()
  for (const ext of ['-wal', '-shm']) rmSync(dbFile() + ext, { force: true })
  copyFileSync(probe, dbFile())
  rmSync(probe, { force: true })
  if (dataKey) installDataKey(dataKey)
  relaunch()
}

/** Restores one of the safety copies kept on this PC (database and key file) and restarts. */
export function restoreSafetyCopy(name: string): void {
  if (!/^[a-z-]+-\d{8}-\d{6}$/.test(name)) throw new Error('error.notFound')
  const dir = join(backupsDir(), name)
  if (!existsSync(join(dir, 'register.db'))) throw new Error('error.notFound')
  assertProgramDatabase(join(dir, 'register.db'))
  closeDb()
  for (const ext of ['-wal', '-shm']) rmSync(dbFile() + ext, { force: true })
  copyFileSync(join(dir, 'register.db'), dbFile())
  if (existsSync(join(dir, 'data.key'))) copyFileSync(join(dir, 'data.key'), keyFile())
  relaunch()
}

export function restoreFromFile(file: string, password: string): void {
  const { db, dataKey } = readPortableBackup(file, password)
  installDatabase(db, dataKey)
}

// ---------- erasing ----------
/** Tables of records (what the guards produce); settings, accounts, levels, register definitions, the watchlist and the audit trail stay. */
const RECORD_TABLES = [
  'register_corrections', 'register_entries', 'visit_cards', 'vehicle_logs', 'visits', 'persons', 'deliveries', 'incident_photos', 'incidents',
  'notes', 'shifts', 'patrol_checks', 'patrol_rounds', 'key_loans', 'expected_visits'
]

/** Deletes every record but keeps how the program is set up; the register numbering starts again at 1. */
export function eraseRecords(includeStudents: boolean): void {
  const db = conn()
  db.exec('BEGIN')
  try {
    for (const t of [...RECORD_TABLES, ...(includeStudents ? ['students'] : [])]) db.exec(`DELETE FROM ${t}`)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  db.exec('VACUUM')
}

/** Back to the first start: the database and its key are deleted, the program restarts and sets itself up again. */
export function factoryReset(): void {
  closeDb()
  for (const ext of ['', '-wal', '-shm']) rmSync(dbFile() + ext, { force: true })
  rmSync(keyFile(), { force: true })
  relaunch()
}

export function restartProgram(): void {
  relaunch()
}

/** True while the program runs without a usable key: only restoring a backup is possible */
let recovery = false
export const setRecovery = (v: boolean): void => { recovery = v }
export const inRecovery = (): boolean => recovery
