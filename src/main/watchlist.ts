import type { WatchHit, WatchInput, WatchLevel, WatchRow } from '@shared/types'
import { decryptText, encrypt, idHash, normalizeId, verifyPin } from './crypto'
import { conn, normPlate, now } from './db'

/**
 * Name key that ignores case, accents, Arabic diacritics / letter variants and word order,
 * so "ERIKSSON Anna-Maria" and "anna maria eriksson" match.
 */
export function normName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ')
}

interface WatchDb {
  id: number; name: string; id_number_enc: Uint8Array | null; plate: string; reason: string; level: WatchLevel
  added_by_name: string; created_at: string; active: number
}

export function listWatch(): WatchRow[] {
  const rows = conn().prepare(`SELECT w.*, u.name AS added_by_name FROM watchlist w JOIN users u ON u.id = w.added_by
    ORDER BY w.active DESC, w.created_at DESC`).all() as unknown as WatchDb[]
  return rows.map((r): WatchRow => ({
    id: r.id, name: r.name, idNumber: decryptText(r.id_number_enc), plate: r.plate, reason: r.reason, level: r.level,
    addedBy: r.added_by_name, createdAt: r.created_at, active: r.active === 1
  }))
}

export function addWatch(input: WatchInput, userId: number): number {
  const id = normalizeId(input.idNumber)
  const plate = normPlate(input.plate)
  if (!input.name.trim() && !id && !plate) throw new Error('error.watchTarget')
  if (!input.reason.trim()) throw new Error('error.reasonRequired')
  const r = conn().prepare(`INSERT INTO watchlist (name, name_norm, id_hash, id_number_enc, plate_norm, plate, reason, level, added_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    input.name.trim(), normName(input.name), id ? idHash(id) : null, id ? encrypt(id) : null, plate, input.plate.trim().toUpperCase(),
    input.reason.trim(), input.level === 'deny' ? 'deny' : 'alert', userId, now()
  )
  return Number(r.lastInsertRowid)
}

export function setWatchActive(id: number, active: boolean): void {
  conn().prepare('UPDATE watchlist SET active = ? WHERE id = ?').run(active ? 1 : 0, id)
}

export function checkWatch(q: { idNumber?: string; name?: string; plate?: string }): WatchHit[] {
  const db = conn()
  const hits = new Map<number, WatchHit>()
  const add = (rows: { id: number; level: WatchLevel; reason: string; name: string }[], match: WatchHit['match']): void => {
    for (const r of rows) if (!hits.has(r.id)) hits.set(r.id, { id: r.id, level: r.level, reason: r.reason, name: r.name, match })
  }
  const query = (where: string, value: string): unknown =>
    db.prepare(`SELECT id, level, reason, name FROM watchlist WHERE active = 1 AND ${where} = ?`).all(value)
  if (q.idNumber && normalizeId(q.idNumber)) add(query('id_hash', idHash(q.idNumber)) as never, 'id')
  if (q.plate && normPlate(q.plate).length >= 3) add(query('plate_norm', normPlate(q.plate)) as never, 'plate')
  // a single word is too vague to match on
  const key = q.name ? normName(q.name) : ''
  if (key.includes(' ')) add(query('name_norm', key) as never, 'name')
  return [...hits.values()]
}

/**
 * Blocks an entry when an ID number / plate is on the "deny" list, unless an administrator's PIN is given.
 * A same-name match only warns the guard: names are not unique.
 * Returns the hits (for the audit) and the administrator who authorised the override, if any.
 */
export function enforceWatch(q: { idNumber?: string; name?: string; plate?: string }, supervisorPin?: string): { hits: WatchHit[]; overrideBy: number | null } {
  const hits = checkWatch(q)
  const blocking = hits.some((h) => h.level === 'deny' && h.match !== 'name')
  if (!blocking) return { hits, overrideBy: null }
  if (supervisorPin) {
    const admins = conn().prepare("SELECT id, pin_hash FROM users WHERE role = 'admin' AND active = 1").all() as { id: number; pin_hash: string }[]
    const admin = admins.find((a) => verifyPin(supervisorPin, a.pin_hash))
    if (admin) return { hits, overrideBy: admin.id }
    throw new Error('error.supervisorPin')
  }
  throw new Error('error.watchlistDeny')
}
