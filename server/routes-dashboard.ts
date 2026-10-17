// API used by the web dashboard (cookie session).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prepareZXingModule, writeBarcode } from 'zxing-wasm/writer'
import { QR_PREREG, SYNC_ENTITIES, type SyncEntity } from '../src/shared/sync.ts'
import { audit, conn, getSetting, now, setSetting } from './db.ts'
import { decrypt, encrypt, hashPassword, newCode } from './crypto.ts'
import {
  canSeeSite, clearCookie, login, logout, requireUser, sessionCookie, setCookie, siteFilter, type Role, type SessionUser
} from './auth.ts'
import { bool, HttpError, num, obj, route, str } from './http.ts'

const ROLES: Role[] = ['owner', 'supervisor', 'host']
const LANGS = ['ar', 'en', 'fr']
const ONLINE_MS = 3 * 60000

let setupToken: string | null = null
/** Printed in the server console on first start: whoever installs the server creates the owner account. */
export function initSetupToken(): string | null {
  const users = (conn().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
  setupToken = users === 0 ? newCode(10) : null
  return setupToken
}

const checkPassword = (pw: string): string => {
  if (pw.length < 8) throw new HttpError(400, 'password_short')
  return pw
}

const isoDate = (v: unknown, fallback: string): string => {
  const s = str(v, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallback
}

const today = (): string => new Date().toISOString().slice(0, 10)

/** start of local day `d` (YYYY-MM-DD) ... end of local day `e`, as ISO bounds */
const range = (q: URLSearchParams): [string, string] => {
  const from = isoDate(q.get('from'), today())
  const to = isoDate(q.get('to'), from)
  return [new Date(`${from}T00:00:00`).toISOString(), new Date(`${to}T23:59:59.999`).toISOString()]
}

const siteNames = (): Map<number, string> =>
  new Map((conn().prepare('SELECT id, name FROM sites').all() as { id: number; name: string }[]).map((s) => [s.id, s.name]))

// ---------- QR codes for pre-registration passes ----------
let writerReady = false
async function qrSvg(text: string): Promise<string> {
  if (!writerReady) {
    const wasm = readFileSync(join(import.meta.dirname, '..', 'node_modules/zxing-wasm/dist/writer/zxing_writer.wasm'))
    prepareZXingModule({ overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer } })
    writerReady = true
  }
  const { svg } = await writeBarcode(text, { format: 'QRCode', scale: 8, ecLevel: 'M' })
  return svg.replace(/<\?xml[^>]*>\s*/, '').replace(/<!DOCTYPE[^>]*>\s*/, '').replace(/<svg width="(\d+)" height="(\d+)"/, '<svg viewBox="0 0 $1 $2"')
}

interface RecordRow { device_id: number; entity: SyncEntity; local_id: number; site_id: number; time: string; data_json: string; device_name: string }

const toRecord = (r: RecordRow, sites: Map<number, string>) => ({
  entity: r.entity, localId: r.local_id, siteId: r.site_id, siteName: sites.get(r.site_id) ?? '', device: r.device_name,
  time: r.time, data: JSON.parse(r.data_json) as Record<string, unknown>
})

export function dashboardRoutes(): void {
  // ---------- first start ----------
  route('GET', '/api/setup', () => ({ needsSetup: setupToken !== null }))

  route('POST', '/api/setup', (req, res) => {
    const b = obj(req.body)
    if (!setupToken || str(b.token, 40).toUpperCase() !== setupToken) throw new HttpError(403, 'bad_setup_token')
    const email = str(b.email, 120)
    if (!/^\S+@\S+$/.test(email)) throw new HttpError(400, 'bad_email')
    const db = conn()
    db.prepare('INSERT INTO users (email, name, role, pass_hash, language, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      email, str(b.name, 80) || email, 'owner', hashPassword(checkPassword(str(b.password, 200))), LANGS.includes(str(b.language)) ? str(b.language) : 'en', now()
    )
    if (str(b.siteName, 120)) db.prepare('INSERT INTO sites (name, created_at) VALUES (?, ?)').run(str(b.siteName, 120), now())
    setupToken = null
    const u = login(email, str(b.password, 200))
    setCookie(res, sessionCookie(u.token))
    audit('setup', { userId: u.id })
    const { token: _t, ...user } = u
    return user
  })

  // ---------- session ----------
  route('POST', '/api/login', (req, res) => {
    const b = obj(req.body)
    const u = login(str(b.email, 120), str(b.password, 200))
    setCookie(res, sessionCookie(u.token))
    audit('login', { userId: u.id })
    const { token: _t, ...user } = u
    return user
  })

  route('POST', '/api/logout', (req, res) => {
    logout(req)
    setCookie(res, clearCookie())
  })

  route('GET', '/api/me', (req) => requireUser(req))

  route('PATCH', '/api/me', (req) => {
    const u = requireUser(req)
    const b = obj(req.body)
    if (LANGS.includes(str(b.language))) conn().prepare('UPDATE users SET language = ? WHERE id = ?').run(str(b.language), u.id)
    if (b.password) conn().prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(checkPassword(str(b.password, 200))), u.id)
  })

  // ---------- sites & posts ----------
  route('GET', '/api/sites', (req) => {
    const u = requireUser(req)
    const f = siteFilter(u, 'id')
    return conn().prepare(`SELECT id, name, address, active FROM sites WHERE ${f.sql} ORDER BY name`).all(...f.params)
      .map((s) => ({ ...(s as object), active: (s as { active: number }).active === 1 }))
  })

  route('POST', '/api/sites', (req) => {
    const u = requireUser(req, ['owner'])
    const b = obj(req.body)
    if (!str(b.name, 120)) throw new HttpError(400, 'name_required')
    const r = conn().prepare('INSERT INTO sites (name, address, created_at) VALUES (?, ?, ?)').run(str(b.name, 120), str(b.address, 300), now())
    audit('site_add', { userId: u.id, detail: str(b.name, 120) })
    return { id: Number(r.lastInsertRowid) }
  })

  route('PATCH', '/api/sites/:id', (req) => {
    const u = requireUser(req, ['owner'])
    const b = obj(req.body)
    const id = num(req.params.id)
    if (b.name !== undefined) {
      if (!str(b.name, 120)) throw new HttpError(400, 'name_required')
      conn().prepare('UPDATE sites SET name = ? WHERE id = ?').run(str(b.name, 120), id)
    }
    if (b.address !== undefined) conn().prepare('UPDATE sites SET address = ? WHERE id = ?').run(str(b.address, 300), id)
    if (b.active !== undefined) conn().prepare('UPDATE sites SET active = ? WHERE id = ?').run(bool(b.active) ? 1 : 0, id)
    audit('site_update', { userId: u.id, detail: String(id) })
  })

  /** One-time code typed on the post to link it to this site (valid 24 h) */
  route('POST', '/api/sites/:id/enroll-code', (req) => {
    const u = requireUser(req, ['owner'])
    const id = num(req.params.id)
    if (!conn().prepare('SELECT 1 FROM sites WHERE id = ? AND active = 1').get(id)) throw new HttpError(404, 'not_found')
    const code = newCode(8)
    const expiresAt = new Date(Date.now() + 86400000).toISOString()
    conn().prepare('INSERT INTO enroll_codes (code, site_id, created_by, expires_at) VALUES (?, ?, ?, ?)').run(code, id, u.id, expiresAt)
    audit('enroll_code', { userId: u.id, detail: String(id) })
    return { code, expiresAt }
  })

  route('GET', '/api/devices', (req) => {
    const u = requireUser(req, ['owner', 'supervisor'])
    const f = siteFilter(u, 'site_id')
    const sites = siteNames()
    return (conn().prepare(`SELECT id, site_id, name, app_version, created_at, last_seen, revoked FROM devices WHERE ${f.sql} ORDER BY site_id, name`)
      .all(...f.params) as { id: number; site_id: number; name: string; app_version: string; created_at: string; last_seen: string | null; revoked: number }[])
      .map((d) => ({
        id: d.id, siteId: d.site_id, siteName: sites.get(d.site_id) ?? '', name: d.name, appVersion: d.app_version, createdAt: d.created_at,
        lastSeen: d.last_seen, revoked: d.revoked === 1, online: !!d.last_seen && Date.now() - Date.parse(d.last_seen) < ONLINE_MS
      }))
  })

  route('POST', '/api/devices/:id/revoke', (req) => {
    const u = requireUser(req, ['owner'])
    conn().prepare('UPDATE devices SET revoked = 1 WHERE id = ?').run(num(req.params.id))
    audit('device_revoked', { userId: u.id, deviceId: num(req.params.id) })
  })

  // ---------- live overview ----------
  route('GET', '/api/overview', (req) => {
    const u = requireUser(req, ['owner', 'supervisor'])
    const db = conn()
    const f = siteFilter(u, 'id')
    const sites = db.prepare(`SELECT id, name, address FROM sites WHERE active = 1 AND ${f.sql} ORDER BY name`).all(...f.params) as
      { id: number; name: string; address: string }[]
    const count = (siteId: number, entity: string, openField: string): number =>
      (db.prepare(`SELECT COUNT(*) AS n FROM records WHERE site_id = ? AND entity = ? AND json_extract(data_json, '$.${openField}') IS NULL`)
        .get(siteId, entity) as { n: number }).n
    const t = today()
    const [todayStart] = range(new URLSearchParams())
    return sites.map((s) => {
      const devices = (db.prepare('SELECT id, name, last_seen FROM devices WHERE site_id = ? AND revoked = 0 ORDER BY name').all(s.id) as
        { id: number; name: string; last_seen: string | null }[])
        .map((d) => ({ id: d.id, name: d.name, lastSeen: d.last_seen, online: !!d.last_seen && Date.now() - Date.parse(d.last_seen) < ONLINE_MS }))
      const parcels = (db.prepare(`SELECT COALESCE(SUM(json_extract(data_json, '$.parcels')), 0) AS n FROM records
        WHERE site_id = ? AND entity = 'delivery' AND json_extract(data_json, '$.pickedUpAt') IS NULL`).get(s.id) as { n: number }).n
      const expectedToday = (db.prepare(`SELECT COUNT(*) AS n FROM prereg WHERE site_id = ? AND status = 'pending' AND valid_from <= ? AND valid_to >= ?`)
        .get(s.id, t, t) as { n: number }).n
      const visitsToday = (db.prepare(`SELECT COUNT(*) AS n FROM records WHERE site_id = ? AND entity = 'visit' AND time >= ?`).get(s.id, todayStart) as { n: number }).n
      return {
        id: s.id, name: s.name, address: s.address, devices,
        insideNow: count(s.id, 'visit', 'timeOut'),
        vehiclesInside: count(s.id, 'vehicle', 'timeOut'),
        openIncidents: count(s.id, 'incident', 'closedAt'),
        keysOut: count(s.id, 'key_loan', 'returnedAt'),
        parcelsWaiting: parcels, expectedToday, visitsToday
      }
    })
  })

  route('GET', '/api/inside', (req) => {
    const u = requireUser(req, ['owner', 'supervisor'])
    const f = siteFilter(u, 'r.site_id', num(req.query.get('site')) || undefined)
    const sites = siteNames()
    return (conn().prepare(`SELECT r.*, d.name AS device_name FROM records r JOIN devices d ON d.id = r.device_id
      WHERE ${f.sql} AND r.entity = 'visit' AND json_extract(r.data_json, '$.timeOut') IS NULL ORDER BY r.time DESC LIMIT 2000`)
      .all(...f.params) as unknown as RecordRow[]).map((r) => toRecord(r, sites))
  })

  // ---------- records & activity ----------
  route('GET', '/api/records', (req) => {
    const u = requireUser(req, ['owner', 'supervisor'])
    const entity = str(req.query.get('entity'), 20) as SyncEntity
    if (!SYNC_ENTITIES.includes(entity)) throw new HttpError(400, 'bad_entity')
    const f = siteFilter(u, 'r.site_id', num(req.query.get('site')) || undefined)
    const [from, to] = range(req.query)
    const params: (string | number)[] = [...f.params, entity, from, to]
    let text = ''
    const q = str(req.query.get('q'), 100)
    if (q) {
      text = ' AND r.data_json LIKE ?'
      params.push(`%${q.replace(/[%_]/g, '')}%`)
    }
    const sites = siteNames()
    return (conn().prepare(`SELECT r.*, d.name AS device_name FROM records r JOIN devices d ON d.id = r.device_id
      WHERE ${f.sql} AND r.entity = ? AND r.time BETWEEN ? AND ?${text} ORDER BY r.time DESC LIMIT 3000`)
      .all(...params) as unknown as RecordRow[]).map((r) => toRecord(r, sites))
  })

  /** Timeline of events across sites, newest first */
  route('GET', '/api/activity', (req) => {
    const u = requireUser(req, ['owner', 'supervisor'])
    const f = siteFilter(u, 'r.site_id', num(req.query.get('site')) || undefined)
    const [from, to] = range(req.query)
    // a record dated a few days earlier can have an event in the range (check-out, pick-up, closing…)
    const scanFrom = new Date(Date.parse(from) - 7 * 86400000).toISOString()
    const sites = siteNames()
    const rows = conn().prepare(`SELECT r.*, d.name AS device_name FROM records r JOIN devices d ON d.id = r.device_id
      WHERE ${f.sql} AND r.time BETWEEN ? AND ? ORDER BY r.time DESC LIMIT 20000`).all(...f.params, scanFrom, to) as unknown as RecordRow[]
    const events: { time: string; kind: string; site: string; title: string; detail: string; guard: string }[] = []
    const push = (time: unknown, kind: string, r: RecordRow, title: unknown, detail: unknown, guard: unknown): void => {
      if (typeof time !== 'string' || time < from || time > to) return
      events.push({ time, kind, site: sites.get(r.site_id) ?? '', title: String(title ?? ''), detail: String(detail ?? ''), guard: String(guard ?? '') })
    }
    for (const r of rows) {
      const d = JSON.parse(r.data_json) as Record<string, unknown>
      switch (r.entity) {
        case 'visit': push(d.timeIn, 'visit_in', r, d.fullName, d.host, d.guardIn); push(d.timeOut, 'visit_out', r, d.fullName, d.notes, d.guardOut); break
        case 'vehicle': push(d.timeIn, 'vehicle_in', r, d.plate, d.driverName, d.guardIn); push(d.timeOut, 'vehicle_out', r, d.plate, d.driverName, d.guardOut); break
        case 'delivery': push(d.time, 'delivery', r, d.recipient, `${d.carrier ?? ''} ×${d.parcels ?? 1}`, d.guard); push(d.pickedUpAt, 'pickup', r, d.recipient, d.pickedUpBy, ''); break
        case 'incident': push(d.occurredAt, 'incident', r, d.type, d.description, d.guard); push(d.closedAt, 'incident_closed', r, d.type, d.resolution, d.closedBy); break
        case 'note': push(d.time, 'note', r, d.category, d.text, d.guard); break
        case 'shift': push(d.startedAt, 'shift_start', r, d.guard, '', d.guard); push(d.endedAt, 'shift_end', r, d.guard, d.handoverNote, d.guard); break
        case 'patrol': push(d.endedAt, 'patrol', r, `${d.done ?? 0} / ${d.total ?? 0}`, d.note, d.guard); break
        case 'key_loan': push(d.outAt, 'key_out', r, d.itemLabel, d.borrower, d.guardOut); push(d.returnedAt, 'key_in', r, d.itemLabel, d.borrower, d.guardIn); break
      }
    }
    return events.sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, 500)
  })

  // ---------- pre-registration ----------
  const preregRow = (p: Record<string, unknown>, sites: Map<number, string>) => ({
    id: p.id, siteId: p.site_id, siteName: sites.get(p.site_id as number) ?? '', refCode: p.ref_code, fullName: p.full_name,
    company: p.company, host: p.host, purpose: p.purpose, phone: p.phone, email: p.email, validFrom: p.valid_from, validTo: p.valid_to,
    notes: p.notes, status: p.status, arrivedAt: p.arrived_at, createdBy: p.created_by_name, createdAt: p.created_at
  })

  route('GET', '/api/prereg', (req) => {
    const u = requireUser(req)
    const f = siteFilter(u, 'p.site_id', num(req.query.get('site')) || undefined)
    const params: (string | number)[] = [...f.params, isoDate(req.query.get('from'), new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))]
    // hosts only see the guests they invited
    const own = u.role === 'host' ? ' AND p.created_by = ?' : ''
    if (own) params.push(u.id)
    const sites = siteNames()
    return (conn().prepare(`SELECT p.*, us.name AS created_by_name FROM prereg p LEFT JOIN users us ON us.id = p.created_by
      WHERE ${f.sql} AND p.valid_to >= ?${own} ORDER BY p.valid_from, p.full_name LIMIT 2000`).all(...params) as Record<string, unknown>[])
      .map((p) => preregRow(p, sites))
  })

  route('POST', '/api/prereg', (req) => {
    const u = requireUser(req)
    const b = obj(req.body)
    const siteId = num(b.siteId)
    if (!canSeeSite(u, siteId) || !conn().prepare('SELECT 1 FROM sites WHERE id = ? AND active = 1').get(siteId)) throw new HttpError(403, 'forbidden')
    const fullName = str(b.fullName, 120)
    if (!fullName) throw new HttpError(400, 'name_required')
    const validFrom = isoDate(b.validFrom, today())
    const validTo = isoDate(b.validTo, validFrom)
    if (validTo < validFrom) throw new HttpError(400, 'bad_dates')
    const db = conn()
    let ref = newCode(6)
    while (db.prepare('SELECT 1 FROM prereg WHERE ref_code = ?').get(ref)) ref = newCode(6)
    const r = db.prepare(`INSERT INTO prereg (site_id, ref_code, full_name, company, host, purpose, phone, email, valid_from, valid_to, notes,
      created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      siteId, ref, fullName, str(b.company, 120), str(b.host, 120) || u.name, str(b.purpose, 200), str(b.phone, 40), str(b.email, 120),
      validFrom, validTo, str(b.notes, 500), u.id, now(), now()
    )
    audit('prereg_add', { userId: u.id, detail: ref })
    return { id: Number(r.lastInsertRowid), refCode: ref }
  })

  route('PATCH', '/api/prereg/:id', (req) => {
    const u = requireUser(req)
    const id = num(req.params.id)
    const p = conn().prepare('SELECT site_id, created_by, status FROM prereg WHERE id = ?').get(id) as { site_id: number; created_by: number; status: string } | undefined
    if (!p || !canSeeSite(u, p.site_id) || (u.role === 'host' && p.created_by !== u.id)) throw new HttpError(404, 'not_found')
    const b = obj(req.body)
    if (b.status === 'cancelled' && p.status === 'pending') {
      conn().prepare("UPDATE prereg SET status = 'cancelled', updated_at = ? WHERE id = ?").run(now(), id)
      audit('prereg_cancel', { userId: u.id, detail: String(id) })
    }
  })

  route('GET', '/api/prereg/:id/qr.svg', async (req, res) => {
    const u = requireUser(req)
    const p = conn().prepare('SELECT site_id, created_by, ref_code FROM prereg WHERE id = ?').get(num(req.params.id)) as
      { site_id: number; created_by: number; ref_code: string } | undefined
    if (!p || !canSeeSite(u, p.site_id) || (u.role === 'host' && p.created_by !== u.id)) throw new HttpError(404, 'not_found')
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, max-age=3600' })
    res.end(await qrSvg(`${QR_PREREG}${p.ref_code}`))
  })

  // ---------- watchlist (whole organisation) ----------
  route('GET', '/api/watchlist', (req) => {
    requireUser(req, ['owner', 'supervisor'])
    return (conn().prepare(`SELECT w.*, u.name AS created_by_name FROM watchlist w LEFT JOIN users u ON u.id = w.created_by
      ORDER BY w.active DESC, w.created_at DESC`).all() as Record<string, unknown>[]).map((w) => ({
      id: w.id, name: w.name, idNumber: decrypt(w.id_number_enc as Uint8Array | null), plate: w.plate, reason: w.reason, level: w.level,
      active: w.active === 1, createdBy: w.created_by_name, createdAt: w.created_at
    }))
  })

  route('POST', '/api/watchlist', (req) => {
    const u = requireUser(req, ['owner', 'supervisor'])
    const b = obj(req.body)
    const name = str(b.name, 120)
    const idNumber = str(b.idNumber, 40).toUpperCase().replace(/[\s\-.<\/]/g, '')
    const plate = str(b.plate, 30).toUpperCase()
    if (!name && !idNumber && !plate) throw new HttpError(400, 'watch_target')
    if (!str(b.reason, 300)) throw new HttpError(400, 'reason_required')
    conn().prepare('INSERT INTO watchlist (name, id_number_enc, plate, reason, level, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      name, encrypt(idNumber), plate, str(b.reason, 300), b.level === 'alert' ? 'alert' : 'deny', u.id, now()
    )
    audit('watchlist_add', { userId: u.id })
  })

  route('PATCH', '/api/watchlist/:id', (req) => {
    const u = requireUser(req, ['owner', 'supervisor'])
    conn().prepare('UPDATE watchlist SET active = ? WHERE id = ?').run(bool(obj(req.body).active) ? 1 : 0, num(req.params.id))
    audit('watchlist_update', { userId: u.id, detail: req.params.id })
  })

  // ---------- users ----------
  route('GET', '/api/users', (req) => {
    requireUser(req, ['owner'])
    const db = conn()
    return (db.prepare('SELECT id, email, name, role, language, active, created_at FROM users ORDER BY name').all() as
      { id: number; email: string; name: string; role: Role; language: string; active: number; created_at: string }[]).map((x): SessionUser & { active: boolean; createdAt: string } => ({
      id: x.id, email: x.email, name: x.name, role: x.role, language: x.language, active: x.active === 1, createdAt: x.created_at,
      siteIds: x.role === 'owner' ? null : (db.prepare('SELECT site_id FROM user_sites WHERE user_id = ?').all(x.id) as { site_id: number }[]).map((s) => s.site_id)
    }))
  })

  const setSites = (userId: number, ids: unknown): void => {
    const db = conn()
    db.prepare('DELETE FROM user_sites WHERE user_id = ?').run(userId)
    const list = Array.isArray(ids) ? ids.map(num).filter((n) => n > 0) : []
    for (const id of new Set(list)) db.prepare('INSERT OR IGNORE INTO user_sites (user_id, site_id) VALUES (?, ?)').run(userId, id)
  }

  route('POST', '/api/users', (req) => {
    const u = requireUser(req, ['owner'])
    const b = obj(req.body)
    const email = str(b.email, 120)
    if (!/^\S+@\S+$/.test(email)) throw new HttpError(400, 'bad_email')
    const role = ROLES.includes(str(b.role) as Role) ? (str(b.role) as Role) : 'host'
    const db = conn()
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'email_taken')
    const r = db.prepare('INSERT INTO users (email, name, role, pass_hash, language, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      email, str(b.name, 80) || email, role, hashPassword(checkPassword(str(b.password, 200))), LANGS.includes(str(b.language)) ? str(b.language) : 'en', now()
    )
    setSites(Number(r.lastInsertRowid), b.siteIds)
    audit('user_add', { userId: u.id, detail: email })
  })

  route('PATCH', '/api/users/:id', (req) => {
    const u = requireUser(req, ['owner'])
    const id = num(req.params.id)
    const b = obj(req.body)
    const db = conn()
    const target = db.prepare('SELECT role, active FROM users WHERE id = ?').get(id) as { role: Role; active: number } | undefined
    if (!target) throw new HttpError(404, 'not_found')
    const owners = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND active = 1").get() as { n: number }).n
    const losesOwner = target.role === 'owner' && target.active === 1 && (b.active === false || (b.role !== undefined && b.role !== 'owner'))
    if (losesOwner && owners <= 1) throw new HttpError(400, 'last_owner')
    if (b.active !== undefined) {
      db.prepare('UPDATE users SET active = ? WHERE id = ?').run(bool(b.active) ? 1 : 0, id)
      if (!bool(b.active)) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
    }
    if (b.role !== undefined && ROLES.includes(str(b.role) as Role)) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(str(b.role), id)
    if (b.siteIds !== undefined) setSites(id, b.siteIds)
    if (b.password) {
      db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(checkPassword(str(b.password, 200))), id)
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
    }
    audit('user_update', { userId: u.id, detail: String(id) })
  })

  // ---------- settings ----------
  route('GET', '/api/settings', (req) => {
    requireUser(req, ['owner'])
    return { retentionDays: Number(getSetting('retentionDays', '365')) }
  })

  route('PUT', '/api/settings', (req) => {
    const u = requireUser(req, ['owner'])
    const days = Math.round(num(obj(req.body).retentionDays))
    if (days < 1 || days > 3650) throw new HttpError(400, 'bad_value')
    setSetting('retentionDays', String(days))
    audit('settings', { userId: u.id })
  })
}
