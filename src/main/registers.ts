// Register engine: definitions (registers + fields) and their entries. Entries are never updated in place
// except through a correction, which is kept (the paper rule: no crossing out, no correction fluid).
import type {
  AccountValue, EntryCorrection, EntryInputValues, EntryQuery, EntryValues, FieldInput, FieldValue, Labels,
  RegisterDef, RegisterDefInput, RegisterEntry, RegisterField, Role, User
} from '@shared/types'
import { cleanDefinition, cleanStep, cleanValue, splitSensitive, type ValueResolvers } from '@shared/registers'
import { templatesFor } from '@shared/registerTemplates'
import { can } from '@shared/permissions'
import { decryptText, encrypt } from './crypto'
import { conn, dayEnd, dayStart, findUserByPin, getUser, now } from './db'

interface RegisterDb {
  id: number; key: string; labels_json: string; icon: string; fill_roles: string; close_roles: string
  close_labels_json: string | null; sort: number; active: number; opened_at: string; opened_by_name: string | null; color: string
}
interface FieldDb {
  key: string; labels_json: string; type: RegisterField['type']; options_json: string; required: number; sensitive: number
  step: string; active: number; hint_json: string; half: number
}
interface EntryDb {
  id: number; register_id: number; number: number; data_json: string; data_enc: Uint8Array | null; created_by_name: string
  created_at: string; post: string; closed_by_name: string | null; closed_at: string | null; corrected: string | null
}

const roles = (s: string): Role[] => s.split(',').filter(Boolean) as Role[]
const json = <T>(s: string | null, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback
  } catch {
    return fallback
  }
}

function fieldsOf(registerId: number): RegisterField[] {
  const rows = conn().prepare('SELECT * FROM register_fields WHERE register_id = ? ORDER BY sort, id').all(registerId) as unknown as FieldDb[]
  return rows.map((f) => ({
    key: f.key, labels: json<Labels>(f.labels_json, { ar: '', en: '', fr: '' }), type: f.type, options: json<string[]>(f.options_json, []),
    required: f.required === 1, sensitive: f.sensitive === 1, step: f.step === 'close' ? 'close' : 'open', active: f.active === 1,
    hint: json<Labels>(f.hint_json, { ar: '', en: '', fr: '' }), half: f.half === 1
  }))
}

const SELECT_REGISTER = `SELECT r.*, u.name AS opened_by_name FROM registers r LEFT JOIN users u ON u.id = r.opened_by`

function toDef(r: RegisterDb): RegisterDef {
  return {
    id: r.id, key: r.key, labels: json<Labels>(r.labels_json, { ar: '', en: '', fr: '' }), icon: r.icon,
    fillRoles: roles(r.fill_roles), closeRoles: roles(r.close_roles), closeLabels: json<Labels | null>(r.close_labels_json, null),
    sort: r.sort, active: r.active === 1, color: r.color,
    entryCount: (conn().prepare('SELECT COUNT(*) AS n FROM register_entries WHERE register_id = ?').get(r.id) as { n: number }).n, openedAt: r.opened_at, openedBy: r.opened_by_name ?? '', fields: fieldsOf(r.id)
  }
}

export function getRegister(id: number): RegisterDef | null {
  const r = conn().prepare(`${SELECT_REGISTER} WHERE r.id = ?`).get(id) as RegisterDb | undefined
  return r ? toDef(r) : null
}

/** Registers this user may fill or close; administrators see all of them, switched off or not. */
export function listRegisters(user: User): RegisterDef[] {
  const all = (conn().prepare(`${SELECT_REGISTER} ORDER BY r.sort, r.id`).all() as unknown as RegisterDb[]).map(toDef)
  if (user.role === 'admin') return all
  return all.filter((r) => r.active && (r.fillRoles.includes(user.role) || r.closeRoles.includes(user.role)))
}

/**
 * Creates or changes a register. A field is never deleted, so old entries stay readable:
 * one left out of the new definition is switched off.
 */
export function saveRegister(input: RegisterDefInput, userId: number): number {
  const def = cleanDefinition(input)
  const db = conn()
  const clash = db.prepare('SELECT id FROM registers WHERE key = ?').get(def.key) as { id: number } | undefined
  if (clash && clash.id !== def.id) throw new Error('error.keyTaken')
  db.exec('BEGIN')
  try {
    let id = def.id ?? 0
    const cols = [JSON.stringify(def.labels), def.icon, def.fillRoles.join(','), def.closeRoles.join(','),
      def.closeLabels ? JSON.stringify(def.closeLabels) : null, def.sort, def.active ? 1 : 0, def.color ?? ''] as const
    if (id) {
      if (!getRegister(id)) throw new Error('error.notFound')
      db.prepare(`UPDATE registers SET labels_json = ?, icon = ?, fill_roles = ?, close_roles = ?, close_labels_json = ?, sort = ?, active = ?, color = ?
        WHERE id = ?`).run(...cols, id)
    } else {
      id = Number(db.prepare(`INSERT INTO registers (labels_json, icon, fill_roles, close_roles, close_labels_json, sort, active, color, key, opened_at, opened_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...cols, def.key, now(), userId).lastInsertRowid)
    }
    const upsert = db.prepare(`INSERT INTO register_fields (register_id, key, labels_json, type, options_json, required, sensitive, step, sort, active, hint_json, half)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (register_id, key) DO UPDATE SET labels_json = excluded.labels_json, options_json = excluded.options_json,
        required = excluded.required, step = excluded.step, sort = excluded.sort, active = excluded.active,
        hint_json = excluded.hint_json, half = excluded.half`)
    // the type and the encryption of an existing field never change: its stored values depend on them
    def.fields.forEach((f, i) => upsert.run(id, f.key, JSON.stringify(f.labels), f.type, JSON.stringify(f.options),
      f.required ? 1 : 0, f.sensitive ? 1 : 0, f.step, i, f.active ? 1 : 0, JSON.stringify(f.hint ?? { ar: '', en: '', fr: '' }), f.half ? 1 : 0))
    const keep = def.fields.map((f) => f.key)
    db.prepare(`UPDATE register_fields SET active = 0 WHERE register_id = ? AND key NOT IN (${keep.map(() => '?').join(',') || "''"})`).run(id, ...keep)
    db.exec('COMMIT')
    return id
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

const resolvers: ValueResolvers = {
  account(userId) {
    const u = getUser(userId)
    return u && u.active ? { userId: u.id, name: u.name } : null
  },
  signature(pin) {
    const u = findUserByPin(pin)
    return u && u.active === 1 ? { userId: u.id, name: u.name } : null
  }
}

const SELECT_ENTRY = `
SELECT e.id, e.register_id, e.number, e.data_json, e.data_enc, c.name AS created_by_name, e.created_at, e.post,
  k.name AS closed_by_name, e.closed_at,
  (SELECT GROUP_CONCAT(DISTINCT field_key) FROM register_corrections WHERE entry_id = e.id) AS corrected
FROM register_entries e
JOIN users c ON c.id = e.created_by
LEFT JOIN users k ON k.id = e.closed_by`

function toEntry(r: EntryDb): RegisterEntry {
  const secret = r.data_enc ? json<EntryValues>(decryptText(r.data_enc), {}) : {}
  return {
    id: r.id, registerId: r.register_id, number: r.number, values: { ...json<EntryValues>(r.data_json, {}), ...secret },
    createdBy: r.created_by_name, createdAt: r.created_at, post: r.post, closedBy: r.closed_by_name, closedAt: r.closed_at,
    corrected: r.corrected ? r.corrected.split(',') : []
  }
}

function writeValues(entryId: number, fields: RegisterField[], values: EntryValues): void {
  const { plain, secret } = splitSensitive(fields, values)
  conn().prepare('UPDATE register_entries SET data_json = ?, data_enc = ? WHERE id = ?')
    .run(JSON.stringify(plain), Object.keys(secret).length ? encrypt(JSON.stringify(secret)) : null, entryId)
}

function entryRow(id: number): RegisterEntry {
  const r = conn().prepare(`${SELECT_ENTRY} WHERE e.id = ?`).get(id) as EntryDb | undefined
  if (!r) throw new Error('error.notFound')
  return toEntry(r)
}

/** The register, checked as usable by this user for this action */
function usable(registerId: number, user: User, action: 'fill' | 'close'): RegisterDef {
  const reg = getRegister(registerId)
  if (!reg) throw new Error('error.notFound')
  if (!reg.active) throw new Error('error.featureOff')
  const allowed = action === 'fill' ? reg.fillRoles : reg.closeRoles
  if (user.role !== 'admin' && !allowed.includes(user.role)) throw new Error('error.forbidden')
  return reg
}

export function addEntry(registerId: number, input: EntryInputValues, user: User, post: string): { id: number; number: number } {
  const reg = usable(registerId, user, 'fill')
  const values = cleanStep(reg.fields, 'open', input, resolvers)
  const db = conn()
  const number = (db.prepare('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM register_entries WHERE register_id = ?').get(registerId) as { n: number }).n
  const id = Number(db.prepare(`INSERT INTO register_entries (register_id, number, data_json, created_by, created_at, post)
    VALUES (?, ?, '{}', ?, ?, ?)`).run(registerId, number, user.id, now(), post).lastInsertRowid)
  writeValues(id, reg.fields, values)
  return { id, number }
}

export function closeEntry(entryId: number, input: EntryInputValues, user: User): number {
  const entry = entryRow(entryId)
  const reg = usable(entry.registerId, user, 'close')
  if (!reg.closeLabels) throw new Error('error.noCloseStep')
  if (entry.closedAt) throw new Error('error.entryClosed')
  const closing = cleanStep(reg.fields, 'close', input, resolvers)
  writeValues(entryId, reg.fields, { ...entry.values, ...closing })
  conn().prepare('UPDATE register_entries SET closed_by = ?, closed_at = ? WHERE id = ?').run(user.id, now(), entryId)
  return reg.id
}

/**
 * A wrong value is corrected, never erased: the old and new values are kept (encrypted) with the reason.
 * Allowed for administrators, team leaders, and whoever recorded the entry.
 */
export function correctEntry(entryId: number, fieldKey: string, input: FieldInput, reason: string, user: User): void {
  const entry = entryRow(entryId)
  const reg = getRegister(entry.registerId)
  const field = reg?.fields.find((f) => f.key === fieldKey)
  if (!reg || !field) throw new Error('error.notFound')
  const author = conn().prepare('SELECT created_by FROM register_entries WHERE id = ?').get(entryId) as { created_by: number }
  if (!can(user, 'correctAny') && author.created_by !== user.id) throw new Error('error.forbidden')
  if (!reason.trim()) throw new Error('error.reasonRequired')
  const value = cleanValue(field, input, resolvers)
  if (value === null && field.required) throw new Error(`error.fieldRequired:${field.key}`)
  const old: FieldValue | null = entry.values[fieldKey] ?? null
  const values = { ...entry.values }
  if (value === null) delete values[fieldKey]
  else values[fieldKey] = value
  conn().prepare('INSERT INTO register_corrections (entry_id, field_key, change_enc, reason, by_user, at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(entryId, fieldKey, encrypt(JSON.stringify({ old, new: value })) as Buffer, reason.trim().slice(0, 500), user.id, now())
  writeValues(entryId, reg.fields, values)
}

export function entryCorrections(entryId: number): EntryCorrection[] {
  const rows = conn().prepare(`SELECT c.field_key, c.change_enc, c.reason, u.name AS by_name, c.at FROM register_corrections c
    JOIN users u ON u.id = c.by_user WHERE c.entry_id = ? ORDER BY c.at`).all(entryId) as {
    field_key: string; change_enc: Uint8Array; reason: string; by_name: string; at: string
  }[]
  return rows.map((r) => {
    const ch = json<{ old: FieldValue | null; new: FieldValue | null }>(decryptText(r.change_enc), { old: null, new: null })
    return { fieldKey: r.field_key, oldValue: ch.old, newValue: ch.new, reason: r.reason, by: r.by_name, at: r.at }
  })
}

/**
 * Entries of a register. The register stays in the security office: only administrators browse its history;
 * the others see the last 24 hours and the entries still waiting for their closing step.
 */
export function listEntries(q: EntryQuery, user: User): RegisterEntry[] {
  const reg = getRegister(q.registerId)
  if (!reg) throw new Error('error.notFound')
  if (user.role !== 'admin' && !reg.fillRoles.includes(user.role) && !reg.closeRoles.includes(user.role)) throw new Error('error.forbidden')
  const where = ['e.register_id = ?']
  const params: (string | number)[] = [q.registerId]
  if (q.openOnly) where.push('e.closed_at IS NULL')
  if (user.role === 'admin') {
    if (q.from && q.to) {
      where.push('(e.created_at BETWEEN ? AND ? OR (e.closed_at IS NULL AND ? = 1))')
      params.push(dayStart(q.from), dayEnd(q.to), q.openOnly ? 1 : 0)
    }
  } else {
    // "waiting for the closing step" only means something for a register that has one
    where.push(reg.closeLabels ? '(e.created_at > ? OR e.closed_at IS NULL)' : 'e.created_at > ?')
    params.push(new Date(Date.now() - 24 * 3600000).toISOString())
  }
  const text = q.text.trim()
  if (text) {
    where.push('e.data_json LIKE ?')
    params.push(`%${text}%`)
  }
  const rows = conn().prepare(`${SELECT_ENTRY} WHERE ${where.join(' AND ')} ORDER BY e.number DESC LIMIT 2000`).all(...params) as unknown as EntryDb[]
  return rows.map(toEntry)
}

/** One entry to print: allowed under the same rules as the list (administrators any entry; others the last 24 hours and open ones). */
export function entryForPrint(entryId: number, user: User): { reg: RegisterDef; entry: RegisterEntry } {
  const entry = entryRow(entryId)
  const reg = getRegister(entry.registerId)
  if (!reg) throw new Error('error.notFound')
  if (user.role !== 'admin') {
    if (!reg.fillRoles.includes(user.role) && !reg.closeRoles.includes(user.role)) throw new Error('error.forbidden')
    const recent = new Date(entry.createdAt).getTime() > Date.now() - 24 * 3600000
    if (!recent && !(reg.closeLabels && !entry.closedAt)) throw new Error('error.forbidden')
  }
  return { reg, entry }
}

/** Active accounts, for 'account' fields (who was absent, who handed over…) */
export function accountsForFields(): { id: number; name: string; role: Role; roleLabels: Labels }[] {
  const rows = conn().prepare('SELECT u.id, u.name, u.role, l.labels_json FROM users u LEFT JOIN levels l ON l.key = u.role WHERE u.active = 1 ORDER BY u.name')
    .all() as unknown as { id: number; name: string; role: Role; labels_json: string | null }[]
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.role, roleLabels: json<Labels>(r.labels_json, { ar: r.role, en: r.role, fr: r.role }) }))
}

/**
 * Questions a later version took out of a ready-made register: on a PC that already has the register they are hidden
 * (never deleted: entries already recorded keep them) and the questions that replace them are added.
 */
const RETIRED_FIELDS: Record<string, string[]> = {
  shift: ['registers_ok', 'incidents_visa', 'team_present', 'outgoing_pin'],
  custody: ['outgoing_pin']
}

export function updateTemplateRegisters(userId: number): void {
  for (const [key, retired] of Object.entries(RETIRED_FIELDS)) {
    const row = conn().prepare('SELECT id FROM registers WHERE key = ?').get(key) as { id: number } | undefined
    const def = row ? getRegister(row.id) : null
    if (!def || !def.fields.some((f) => retired.includes(f.key) && f.active)) continue
    const fields = def.fields.map((f) => (retired.includes(f.key) ? { ...f, active: false } : f))
    for (const f of templatesFor([key])[0].fields) if (!fields.some((x) => x.key === f.key)) fields.push(f)
    saveRegister({ ...def, fields }, userId)
  }
}

/** Ready-made registers an administrator deleted: they are not opened again at the next start. */
function deletedTemplates(): string[] {
  const row = conn().prepare("SELECT value FROM settings WHERE key = 'deletedTemplates'").get() as { value: string } | undefined
  return json<string[]>(row?.value ?? null, [])
}

/**
 * Deletes a register with its fields, entries and corrections. Entries are never erased otherwise, so the caller asks for
 * the administrator's PIN when there are any and makes a safety copy first. Returns the register and how many entries went.
 */
export function deleteRegister(id: number): { key: string; entries: number } {
  const reg = getRegister(id)
  if (!reg) throw new Error('error.notFound')
  const db = conn()
  const entries = (db.prepare('SELECT COUNT(*) AS n FROM register_entries WHERE register_id = ?').get(id) as { n: number }).n
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM register_corrections WHERE entry_id IN (SELECT id FROM register_entries WHERE register_id = ?)').run(id)
    db.prepare('DELETE FROM register_entries WHERE register_id = ?').run(id)
    db.prepare('DELETE FROM register_fields WHERE register_id = ?').run(id)
    db.prepare('DELETE FROM registers WHERE id = ?').run(id)
    if (templatesFor([reg.key]).length) {
      db.prepare("INSERT INTO settings (key, value) VALUES ('deletedTemplates', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .run(JSON.stringify([...new Set([...deletedTemplates(), reg.key])]))
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return { key: reg.key, entries }
}

/** Opens the ready-made registers asked for that do not exist yet (an organisation's first start). */
export function installTemplates(keys: string[], userId: number): number {
  const have = new Set((conn().prepare('SELECT key FROM registers').all() as { key: string }[]).map((r) => r.key))
  const gone = new Set(deletedTemplates())
  const missing = templatesFor(keys).filter((t) => !have.has(t.key) && !gone.has(t.key))
  for (const t of missing) saveRegister(t, userId)
  return missing.length
}
