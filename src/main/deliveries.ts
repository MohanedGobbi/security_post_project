import type { DeliveryInput, DeliveryRow, RangeQuery } from '@shared/types'
import { decryptBuffer, encrypt } from './crypto'
import { conn, dayEnd, dayStart, now, parseCustom } from './db'

interface DeliveryDb {
  id: number; time: string; carrier: string; courier_name: string; recipient: string; parcels: number; tracking: string
  notes: string; guard_name: string; picked_up_at: string | null; picked_up_by: string; guard_pickup_name: string | null; has_photo: number; custom_json: string
}

const SELECT = `
SELECT d.id, d.time, d.carrier, d.courier_name, d.recipient, d.parcels, d.tracking, d.notes, g.name AS guard_name,
  d.picked_up_at, d.picked_up_by, gp.name AS guard_pickup_name, (d.photo_enc IS NOT NULL) AS has_photo, d.custom_json
FROM deliveries d
JOIN users g ON g.id = d.guard_id
LEFT JOIN users gp ON gp.id = d.guard_pickup`

const toRow = (r: DeliveryDb): DeliveryRow => ({
  id: r.id, time: r.time, carrier: r.carrier, courierName: r.courier_name, recipient: r.recipient, parcels: r.parcels,
  tracking: r.tracking, notes: r.notes, guard: r.guard_name, pickedUpAt: r.picked_up_at, pickedUpBy: r.picked_up_by,
  guardPickup: r.guard_pickup_name, hasPhoto: r.has_photo === 1, custom: parseCustom(r.custom_json)
})

export function addDelivery(input: DeliveryInput, guardId: number, post: string): number {
  if (!input.recipient.trim()) throw new Error('error.recipientRequired')
  const r = conn().prepare(`INSERT INTO deliveries (time, carrier, courier_name, recipient, parcels, tracking, notes, photo_enc, guard_id, post, custom_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    now(), input.carrier.trim(), input.courierName.trim(), input.recipient.trim(), Math.max(1, Math.round(Number(input.parcels) || 1)),
    input.tracking.trim(), input.notes.trim(), input.photo ? encrypt(Buffer.from(input.photo)) : null, guardId, post, JSON.stringify(input.custom ?? {})
  )
  return Number(r.lastInsertRowid)
}

export function pickUp(id: number, by: string, guardId: number): void {
  if (!by.trim()) throw new Error('error.pickupRequired')
  const db = conn()
  const d = db.prepare('SELECT picked_up_at FROM deliveries WHERE id = ?').get(id) as { picked_up_at: string | null } | undefined
  if (!d) throw new Error('error.notFound')
  if (d.picked_up_at) throw new Error('error.alreadyPickedUp')
  db.prepare('UPDATE deliveries SET picked_up_at = ?, picked_up_by = ?, guard_pickup = ? WHERE id = ?').run(now(), by.trim(), guardId, id)
}

export function waitingDeliveries(): DeliveryRow[] {
  return (conn().prepare(`${SELECT} WHERE d.picked_up_at IS NULL ORDER BY d.time`).all() as unknown as DeliveryDb[]).map(toRow)
}

export function searchDeliveries(q: RangeQuery): DeliveryRow[] {
  const where = ['d.time BETWEEN ? AND ?']
  const params: string[] = [dayStart(q.from), dayEnd(q.to)]
  const text = q.text.trim()
  if (text) {
    const like = `%${text}%`
    where.push('(d.carrier LIKE ? OR d.courier_name LIKE ? OR d.recipient LIKE ? OR d.tracking LIKE ? OR d.notes LIKE ? OR d.picked_up_by LIKE ? OR d.custom_json LIKE ?)')
    params.push(like, like, like, like, like, like, like)
  }
  return (conn().prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY d.time DESC LIMIT 5000`).all(...params) as unknown as DeliveryDb[]).map(toRow)
}

export function deliveryPhoto(id: number): Uint8Array | null {
  const r = conn().prepare('SELECT photo_enc FROM deliveries WHERE id = ?').get(id) as { photo_enc: Uint8Array | null } | undefined
  const buf = decryptBuffer(r?.photo_enc)
  return buf ? new Uint8Array(buf) : null
}

/** Frequent recipients over the last 90 days, for quick-pick chips */
export function frequentRecipients(): string[] {
  const since = new Date(Date.now() - 90 * 86400000).toISOString()
  return (conn().prepare(`SELECT recipient AS v, COUNT(*) AS n FROM deliveries WHERE time > ? GROUP BY recipient ORDER BY n DESC LIMIT 8`)
    .all(since) as { v: string }[]).map((r) => r.v)
}
