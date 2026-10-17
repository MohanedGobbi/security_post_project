// API used by the posts (desktop apps): enrollment and periodic sync.
import { SYNC_ENTITIES, type EnrollResponse, type ServerExpected, type ServerWatchEntry, type SyncEntity, type SyncResponse } from '../src/shared/sync.ts'
import { audit, conn, now } from './db.ts'
import { decrypt, newToken, sha256 } from './crypto.ts'
import { requireDevice } from './auth.ts'
import { HttpError, num, obj, route, str } from './http.ts'

const MAX_RECORDS = 1000

export function deviceRoutes(): void {
  /** One-time code from the dashboard → device token (shown once, only its hash is kept) */
  route('POST', '/api/device/enroll', (req): EnrollResponse => {
    const b = obj(req.body)
    const code = str(b.code, 20).toUpperCase().replace(/[^A-Z0-9]/g, '')
    const db = conn()
    const c = db.prepare('SELECT code, site_id, expires_at, used_at FROM enroll_codes WHERE code = ?').get(code) as
      { code: string; site_id: number; expires_at: string; used_at: string | null } | undefined
    if (!c || c.used_at || c.expires_at < now()) throw new HttpError(400, 'bad_code')
    const site = db.prepare('SELECT id, name, active FROM sites WHERE id = ?').get(c.site_id) as { id: number; name: string; active: number }
    if (site.active !== 1) throw new HttpError(400, 'bad_code')
    const token = newToken()
    const r = db.prepare('INSERT INTO devices (site_id, name, token_hash, app_version, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)').run(
      site.id, str(b.deviceName, 80) || 'Post', sha256(token), str(b.appVersion, 20), now(), now()
    )
    db.prepare('UPDATE enroll_codes SET used_at = ? WHERE code = ?').run(now(), code)
    const deviceId = Number(r.lastInsertRowid)
    audit('device_enrolled', { deviceId, detail: site.name })
    return { token, deviceId, siteId: site.id, siteName: site.name }
  })

  /** Upload new / changed records and arrivals; download watchlist and expected visitors of the site */
  route('POST', '/api/device/sync', (req): SyncResponse => {
    const device = requireDevice(req)
    const b = obj(req.body)
    const db = conn()
    const records = Array.isArray(b.records) ? b.records.slice(0, MAX_RECORDS) : []
    const arrivals = Array.isArray(b.arrivals) ? b.arrivals.slice(0, MAX_RECORDS) : []

    const upsert = db.prepare(`INSERT INTO records (device_id, entity, local_id, site_id, time, data_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id, entity, local_id) DO UPDATE SET time = excluded.time, data_json = excluded.data_json, updated_at = excluded.updated_at`)
    const arrive = db.prepare(`UPDATE prereg SET status = 'arrived', arrived_at = ?, arrived_device_id = ?, updated_at = ?
      WHERE id = ? AND site_id = ? AND status = 'pending'`)
    db.exec('BEGIN')
    try {
      for (const raw of records) {
        const r = obj(raw)
        const entity = str(r.entity, 20) as SyncEntity
        const localId = Math.trunc(num(r.localId))
        const time = str(r.time, 40)
        if (!SYNC_ENTITIES.includes(entity) || localId <= 0 || Number.isNaN(Date.parse(time))) continue
        const data = JSON.stringify(obj(r.data))
        if (data.length > 200_000) continue
        upsert.run(device.id, entity, localId, device.siteId, new Date(time).toISOString(), data, now())
      }
      for (const raw of arrivals) {
        const a = obj(raw)
        const at = str(a.arrivedAt, 40)
        arrive.run(Number.isNaN(Date.parse(at)) ? now() : new Date(at).toISOString(), device.id, now(), Math.trunc(num(a.preregId)), device.siteId)
      }
      db.prepare('UPDATE devices SET last_seen = ?, app_version = ? WHERE id = ?').run(now(), str(b.appVersion, 20), device.id)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }

    const watchlist = (db.prepare('SELECT * FROM watchlist WHERE active = 1').all() as
      { id: number; name: string; id_number_enc: Uint8Array | null; plate: string; reason: string; level: 'deny' | 'alert'; active: number }[])
      .map((w): ServerWatchEntry => ({
        id: w.id, name: w.name, idNumber: decrypt(w.id_number_enc), plate: w.plate, reason: w.reason, level: w.level, active: true
      }))
    // yesterday onwards, all statuses (so a post learns about cancellations)
    const since = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const expected = (db.prepare(`SELECT * FROM prereg WHERE site_id = ? AND valid_to >= ? ORDER BY valid_from LIMIT 1000`).all(device.siteId, since) as
      { id: number; ref_code: string; full_name: string; company: string; host: string; purpose: string; phone: string; valid_from: string;
        valid_to: string; notes: string; status: ServerExpected['status'] }[])
      .map((p): ServerExpected => ({
        id: p.id, refCode: p.ref_code, fullName: p.full_name, company: p.company, host: p.host, purpose: p.purpose, phone: p.phone,
        validFrom: p.valid_from, validTo: p.valid_to, notes: p.notes, status: p.status
      }))
    const site = db.prepare('SELECT name FROM sites WHERE id = ?').get(device.siteId) as { name: string }
    return { serverTime: now(), siteName: site.name, watchlist, expected }
  })
}
