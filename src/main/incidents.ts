import type { IncidentDetail, IncidentInput, IncidentRow, IncidentType, RangeQuery, Severity } from '@shared/types'
import { decryptBuffer, encrypt } from './crypto'
import { conn, dayEnd, dayStart, now } from './db'

const TYPES: IncidentType[] = ['theft', 'intrusion', 'damage', 'fire_alarm', 'medical', 'fight', 'suspicious', 'lost_found', 'safety', 'other']
const SEVERITIES: Severity[] = ['low', 'medium', 'high']
const MAX_PHOTOS = 8

interface IncidentDb {
  id: number; type: IncidentType; severity: Severity; occurred_at: string; created_at: string; location: string
  description: string; people_involved: string; action_taken: string; guard_name: string; closed_at: string | null
  closed_by_name: string | null; resolution: string; photo_count: number
}

const SELECT = `
SELECT i.id, i.type, i.severity, i.occurred_at, i.created_at, i.location, i.description, i.people_involved, i.action_taken,
  g.name AS guard_name, i.closed_at, c.name AS closed_by_name, i.resolution,
  (SELECT COUNT(*) FROM incident_photos p WHERE p.incident_id = i.id) AS photo_count
FROM incidents i
JOIN users g ON g.id = i.guard_id
LEFT JOIN users c ON c.id = i.closed_by`

const toRow = (r: IncidentDb): IncidentRow => ({
  id: r.id, type: r.type, severity: r.severity, occurredAt: r.occurred_at, createdAt: r.created_at, location: r.location,
  description: r.description, peopleInvolved: r.people_involved, actionTaken: r.action_taken, guard: r.guard_name,
  closedAt: r.closed_at, closedBy: r.closed_by_name, resolution: r.resolution, photoCount: r.photo_count
})

export function addIncident(input: IncidentInput, guardId: number, post: string): number {
  if (!input.description.trim()) throw new Error('error.textRequired')
  const type = TYPES.includes(input.type) ? input.type : 'other'
  const severity = SEVERITIES.includes(input.severity) ? input.severity : 'medium'
  const occurred = new Date(input.occurredAt)
  const occurredAt = Number.isNaN(occurred.getTime()) || occurred.getTime() > Date.now() + 60000 ? now() : occurred.toISOString()
  const db = conn()
  db.exec('BEGIN')
  try {
    const r = db.prepare(`INSERT INTO incidents (type, severity, occurred_at, created_at, location, description, people_involved,
      action_taken, guard_id, post) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      type, severity, occurredAt, now(), input.location.trim(), input.description.trim(), input.peopleInvolved.trim(),
      input.actionTaken.trim(), guardId, post
    )
    const id = Number(r.lastInsertRowid)
    const insertPhoto = db.prepare('INSERT INTO incident_photos (incident_id, photo_enc) VALUES (?, ?)')
    for (const p of (input.photos ?? []).slice(0, MAX_PHOTOS)) insertPhoto.run(id, encrypt(Buffer.from(p)))
    db.exec('COMMIT')
    return id
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function closeIncident(id: number, resolution: string, userId: number): void {
  const db = conn()
  const i = db.prepare('SELECT closed_at FROM incidents WHERE id = ?').get(id) as { closed_at: string | null } | undefined
  if (!i) throw new Error('error.notFound')
  if (i.closed_at) throw new Error('error.alreadyClosed')
  db.prepare('UPDATE incidents SET closed_at = ?, closed_by = ?, resolution = ? WHERE id = ?').run(now(), userId, resolution.trim(), id)
}

export function openIncidents(): IncidentRow[] {
  return (conn().prepare(`${SELECT} WHERE i.closed_at IS NULL ORDER BY
    CASE i.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, i.occurred_at DESC`).all() as unknown as IncidentDb[]).map(toRow)
}

export function searchIncidents(q: RangeQuery): IncidentRow[] {
  const where = ['i.occurred_at BETWEEN ? AND ?']
  const params: string[] = [dayStart(q.from), dayEnd(q.to)]
  const text = q.text.trim()
  if (text) {
    const like = `%${text}%`
    where.push('(i.location LIKE ? OR i.description LIKE ? OR i.people_involved LIKE ? OR i.action_taken LIKE ? OR i.resolution LIKE ?)')
    params.push(like, like, like, like, like)
  }
  return (conn().prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY i.occurred_at DESC LIMIT 5000`).all(...params) as unknown as IncidentDb[]).map(toRow)
}

export function getIncident(id: number): IncidentDetail {
  const db = conn()
  const r = db.prepare(`${SELECT} WHERE i.id = ?`).get(id) as IncidentDb | undefined
  if (!r) throw new Error('error.notFound')
  const photos = (db.prepare('SELECT photo_enc FROM incident_photos WHERE incident_id = ? ORDER BY id').all(id) as { photo_enc: Uint8Array }[])
    .map((p) => decryptBuffer(p.photo_enc))
    .filter((b): b is Buffer => !!b)
    .map((b) => new Uint8Array(b))
  return { ...toRow(r), photos }
}
