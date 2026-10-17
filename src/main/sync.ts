import { createHash } from 'node:crypto'
import { app } from 'electron'
import type { SyncStatus } from '@shared/types'
import {
  maskId, type EnrollResponse, type SyncCustom, type SyncEntity, type SyncRecord, type SyncRequest, type SyncResponse
} from '@shared/sync'
import { conn, parseCustom } from './db'
import { decryptText, encrypt } from './crypto'
import { replaceServerWatch } from './watchlist'
import { applyServerExpected, markArrivalsSynced, pendingArrivals } from './expected'

interface SyncConfig {
  url: string
  deviceId: number
  deviceName: string
  siteName: string
  /** device token, encrypted with the data key (itself protected by Windows) */
  tokenEnc: string
  lastSync: string | null
  lastError: string
}

/** a database row read for upload (columns differ per table) */
type Row = Record<string, any>

const WINDOW_DAYS = 30
const BATCH = 500
const INTERVAL_MS = 60000

let syncing = false
let online = false
let timer: ReturnType<typeof setInterval> | null = null

// ---------- configuration ----------
function readConfig(): SyncConfig | null {
  const r = conn().prepare("SELECT value FROM settings WHERE key = 'sync'").get() as { value: string } | undefined
  if (!r) return null
  try {
    return JSON.parse(r.value) as SyncConfig
  } catch {
    return null
  }
}

function writeConfig(c: SyncConfig | null): void {
  if (!c) {
    conn().prepare("DELETE FROM settings WHERE key = 'sync'").run()
    return
  }
  conn().prepare("INSERT INTO settings (key, value) VALUES ('sync', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(c))
}

export function syncStatus(): SyncStatus {
  const c = readConfig()
  return {
    configured: !!c, url: c?.url ?? '', siteName: c?.siteName ?? '', deviceName: c?.deviceName ?? '',
    lastSync: c?.lastSync ?? null, lastError: c?.lastError ?? '', online, syncing
  }
}

function normalizeUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`
  try {
    return new URL(u).origin
  } catch {
    throw new Error('error.syncBadUrl')
  }
}

async function post<T>(url: string, body: unknown, token?: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    })
  } catch {
    throw new Error('error.syncUnreachable')
  }
  if (res.status === 401) throw new Error('error.syncRevoked')
  if (res.status === 400) throw new Error('error.syncBadCode')
  if (!res.ok) throw new Error('error.syncServer')
  return (await res.json()) as T
}

/** Links this post to a site of the server with the one-time code shown in the dashboard */
export async function connect(rawUrl: string, code: string, deviceName: string): Promise<SyncStatus> {
  const url = normalizeUrl(rawUrl)
  const r = await post<EnrollResponse>(`${url}/api/device/enroll`, { code: code.trim(), deviceName: deviceName.trim() || 'Post', appVersion: app.getVersion() })
  writeConfig({
    url, deviceId: r.deviceId, deviceName: deviceName.trim() || 'Post', siteName: r.siteName,
    tokenEnc: (encrypt(r.token) as Buffer).toString('base64'), lastSync: null, lastError: ''
  })
  // everything is sent again to the new server
  conn().exec('DELETE FROM sync_state')
  await runSync()
  return syncStatus()
}

/** Unlinks the post. Server watchlist and pre-registrations received from it are removed; local data stays. */
export function disconnect(): void {
  writeConfig(null)
  const db = conn()
  db.exec('DELETE FROM sync_state')
  db.exec('DELETE FROM server_watchlist')
  db.exec("DELETE FROM expected_visits WHERE server_id IS NOT NULL AND status = 'pending'")
  online = false
}

// ---------- collecting records ----------
function customList(json: string): SyncCustom[] {
  const values = parseCustom(json)
  const fields = conn().prepare('SELECT id, labels_json FROM custom_fields').all() as { id: number; labels_json: string }[]
  return fields.filter((f) => values[String(f.id)]).map((f) => ({ labels: JSON.parse(f.labels_json) as SyncCustom['labels'], value: values[String(f.id)] }))
}

/** Records of the last 30 days, plus anything still open (people inside, parcels waiting, open incidents…) */
function collect(): SyncRecord[] {
  const db = conn()
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()
  const out: SyncRecord[] = []
  const add = (entity: SyncEntity, localId: number, time: string, data: unknown): void => { out.push({ entity, localId, time, data }) }

  for (const r of db.prepare(`SELECT v.*, p.full_name, p.full_name_alt, p.id_type, p.id_number_enc, p.company, gi.name AS gin, go.name AS gout
    FROM visits v JOIN persons p ON p.id = v.person_id JOIN users gi ON gi.id = v.guard_in LEFT JOIN users go ON go.id = v.guard_out
    WHERE v.time_in >= ? OR v.time_out IS NULL`).all(since) as Row[]) {
    add('visit', r.id, r.time_in, {
      fullName: r.full_name, fullNameAlt: r.full_name_alt, idType: r.id_type, idMasked: maskId(decryptText(r.id_number_enc)), company: r.company,
      host: r.host, purpose: r.purpose, badgeNo: r.badge_no, vehiclePlate: r.vehicle_plate, notes: r.notes, timeIn: r.time_in, timeOut: r.time_out,
      guardIn: r.gin, guardOut: r.gout, custom: customList(r.custom_json)
    })
  }
  for (const r of db.prepare(`SELECT l.*, gi.name AS gin, go.name AS gout FROM vehicle_logs l JOIN users gi ON gi.id = l.guard_in
    LEFT JOIN users go ON go.id = l.guard_out WHERE l.time_in >= ? OR l.time_out IS NULL`).all(since) as Row[]) {
    add('vehicle', r.id, r.time_in, {
      plate: r.plate, vehicleType: r.vehicle_type, color: r.color, driverName: r.driver_name, company: r.company, passengers: r.passengers,
      cargo: r.cargo, notes: r.notes, timeIn: r.time_in, timeOut: r.time_out, guardIn: r.gin, guardOut: r.gout, custom: customList(r.custom_json)
    })
  }
  for (const r of db.prepare(`SELECT d.*, g.name AS gname FROM deliveries d JOIN users g ON g.id = d.guard_id
    WHERE d.time >= ? OR d.picked_up_at IS NULL`).all(since) as Row[]) {
    add('delivery', r.id, r.time, {
      recipient: r.recipient, carrier: r.carrier, courierName: r.courier_name, parcels: r.parcels, tracking: r.tracking, notes: r.notes,
      time: r.time, guard: r.gname, pickedUpAt: r.picked_up_at, pickedUpBy: r.picked_up_by, custom: customList(r.custom_json)
    })
  }
  for (const r of db.prepare(`SELECT i.*, g.name AS gname, c.name AS cname, (SELECT COUNT(*) FROM incident_photos p WHERE p.incident_id = i.id) AS photos
    FROM incidents i JOIN users g ON g.id = i.guard_id LEFT JOIN users c ON c.id = i.closed_by
    WHERE i.occurred_at >= ? OR i.closed_at IS NULL`).all(since) as Row[]) {
    add('incident', r.id, r.occurred_at, {
      type: r.type, severity: r.severity, occurredAt: r.occurred_at, location: r.location, description: r.description,
      peopleInvolved: r.people_involved, actionTaken: r.action_taken, guard: r.gname, closedAt: r.closed_at, closedBy: r.cname,
      resolution: r.resolution, photoCount: r.photos
    })
  }
  for (const r of db.prepare('SELECT n.*, u.name AS gname FROM notes n JOIN users u ON u.id = n.guard_id WHERE n.time >= ?').all(since) as Row[]) {
    add('note', r.id, r.time, { time: r.time, category: r.category, text: r.text, guard: r.gname })
  }
  for (const r of db.prepare(`SELECT s.*, u.name AS gname, a.name AS aname FROM shifts s JOIN users u ON u.id = s.user_id
    LEFT JOIN users a ON a.id = s.acknowledged_by WHERE s.started_at >= ? OR s.ended_at IS NULL`).all(since) as Row[]) {
    add('shift', r.id, r.started_at, { guard: r.gname, startedAt: r.started_at, endedAt: r.ended_at, handoverNote: r.handover_note, acknowledgedBy: r.aname })
  }
  for (const r of db.prepare(`SELECT r.*, u.name AS gname FROM patrol_rounds r JOIN users u ON u.id = r.guard_id
    WHERE r.started_at >= ? OR r.ended_at IS NULL`).all(since) as Row[]) {
    const checks = db.prepare(`SELECT k.name, c.status, c.note, c.time FROM checkpoints k
      LEFT JOIN patrol_checks c ON c.checkpoint_id = k.id AND c.round_id = ? WHERE k.active = 1 OR c.id IS NOT NULL ORDER BY k.sort, k.id`)
      .all(r.id) as { name: string; status: string | null; note: string | null; time: string | null }[]
    add('patrol', r.id, r.started_at, {
      guard: r.gname, startedAt: r.started_at, endedAt: r.ended_at, note: r.note, total: checks.length,
      done: checks.filter((c) => c.status).length, issues: checks.filter((c) => c.status === 'issue').length,
      checks: checks.map((c) => ({ name: c.name, status: c.status, note: c.note ?? '', time: c.time }))
    })
  }
  for (const r of db.prepare(`SELECT l.*, i.label, go.name AS gout, gi.name AS gin FROM key_loans l JOIN key_items i ON i.id = l.item_id
    JOIN users go ON go.id = l.guard_out LEFT JOIN users gi ON gi.id = l.guard_in WHERE l.out_at >= ? OR l.returned_at IS NULL`).all(since) as Row[]) {
    add('key_loan', r.id, r.out_at, {
      itemLabel: r.label, borrower: r.borrower, borrowerInfo: r.borrower_info, outAt: r.out_at, dueAt: r.due_at, returnedAt: r.returned_at,
      guardOut: r.gout, guardIn: r.gin, notes: r.notes
    })
  }
  // only the ones created on this post: those from the dashboard already live on the server
  for (const r of db.prepare('SELECT * FROM expected_visits WHERE server_id IS NULL AND valid_to >= ?').all(since.slice(0, 10)) as Row[]) {
    add('expected', r.id, `${r.valid_from}T00:00:00.000Z`, {
      refCode: r.ref_code, fullName: r.full_name, company: r.company, host: r.host, purpose: r.purpose, validFrom: r.valid_from,
      validTo: r.valid_to, status: r.status, arrivedAt: r.arrived_at
    })
  }
  return out
}

const fingerprint = (r: SyncRecord): string => createHash('sha256').update(`${r.time}|${JSON.stringify(r.data)}`).digest('hex')

// ---------- one sync round ----------
export async function runSync(): Promise<SyncStatus> {
  const c = readConfig()
  if (!c || syncing) return syncStatus()
  syncing = true
  const db = conn()
  try {
    const token = decryptText(Buffer.from(c.tokenEnc, 'base64'))
    const known = new Map((db.prepare('SELECT entity, local_id, hash FROM sync_state').all() as { entity: string; local_id: number; hash: string }[])
      .map((s) => [`${s.entity}:${s.local_id}`, s.hash]))
    const changed = collect().map((r) => ({ r, hash: fingerprint(r) })).filter((x) => known.get(`${x.r.entity}:${x.r.localId}`) !== x.hash)
    const arrivals = pendingArrivals()
    const saveState = db.prepare(`INSERT INTO sync_state (entity, local_id, hash) VALUES (?, ?, ?)
      ON CONFLICT(entity, local_id) DO UPDATE SET hash = excluded.hash`)

    let response: SyncResponse | null = null
    let i = 0
    do {
      const batch = changed.slice(i, i + BATCH)
      const body: SyncRequest = {
        appVersion: app.getVersion(),
        records: batch.map((x) => x.r),
        arrivals: i === 0 ? arrivals.map(({ preregId, arrivedAt, visitLocalId }) => ({ preregId, arrivedAt, visitLocalId })) : []
      }
      response = await post<SyncResponse>(`${c.url}/api/device/sync`, body, token)
      for (const x of batch) saveState.run(x.r.entity, x.r.localId, x.hash)
      if (i === 0) markArrivalsSynced(arrivals.map((a) => a.localId))
      i += BATCH
    } while (i < changed.length)

    replaceServerWatch(response.watchlist)
    applyServerExpected(response.expected)
    online = true
    writeConfig({ ...c, siteName: response.siteName, lastSync: new Date().toISOString(), lastError: '' })
  } catch (e) {
    online = false
    const msg = e instanceof Error && e.message.startsWith('error.') ? e.message : 'error.syncServer'
    writeConfig({ ...c, lastError: msg })
  } finally {
    syncing = false
  }
  return syncStatus()
}

export function startSyncLoop(): void {
  if (timer) return
  setTimeout(() => void runSync(), 5000)
  timer = setInterval(() => void runSync(), INTERVAL_MS)
}

export function stopSyncLoop(): void {
  if (timer) clearInterval(timer)
  timer = null
}
