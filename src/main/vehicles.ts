import type { RangeQuery, VehicleInInput, VehicleLookup, VehicleRow, VehicleType } from '@shared/types'
import { decryptBuffer, encrypt } from './crypto'
import { conn, dayEnd, dayStart, normPlate, now, parseCustom } from './db'

interface VehicleDb {
  id: number; plate: string; vehicle_type: VehicleType; color: string; driver_name: string; company: string
  passengers: number; cargo: string; notes: string; visit_id: number | null; time_in: string; time_out: string | null
  guard_in_name: string; guard_out_name: string | null; has_photo: number; custom_json: string
}

const SELECT = `
SELECT l.id, l.plate, l.vehicle_type, l.color, l.driver_name, l.company, l.passengers, l.cargo, l.notes, l.visit_id,
  l.time_in, l.time_out, gi.name AS guard_in_name, go.name AS guard_out_name, (l.photo_enc IS NOT NULL) AS has_photo, l.custom_json
FROM vehicle_logs l
JOIN users gi ON gi.id = l.guard_in
LEFT JOIN users go ON go.id = l.guard_out`

const toRow = (r: VehicleDb): VehicleRow => ({
  id: r.id, plate: r.plate, vehicleType: r.vehicle_type, color: r.color, driverName: r.driver_name, company: r.company,
  passengers: r.passengers, cargo: r.cargo, notes: r.notes, visitId: r.visit_id, timeIn: r.time_in, timeOut: r.time_out,
  guardIn: r.guard_in_name, guardOut: r.guard_out_name, hasPhoto: r.has_photo === 1, custom: parseCustom(r.custom_json)
})

export function lookupVehicle(plate: string): VehicleLookup | null {
  const p = normPlate(plate)
  if (p.length < 3) return null
  const db = conn()
  const count = (db.prepare('SELECT COUNT(*) AS n, MAX(time_in) AS last FROM vehicle_logs WHERE plate_norm = ?').get(p) as { n: number; last: string | null })
  if (count.n === 0) return null
  const inside = db.prepare('SELECT id FROM vehicle_logs WHERE plate_norm = ? AND time_out IS NULL LIMIT 1').get(p) as { id: number } | undefined
  const last = db.prepare(`SELECT vehicle_type, color, driver_name, company FROM vehicle_logs WHERE plate_norm = ?
    ORDER BY time_in DESC LIMIT 1`).get(p) as { vehicle_type: VehicleType; color: string; driver_name: string; company: string }
  return {
    visits: count.n,
    lastSeen: count.last,
    insideId: inside?.id ?? null,
    last: { vehicleType: last.vehicle_type, color: last.color, driverName: last.driver_name, company: last.company }
  }
}

export function vehicleIn(input: VehicleInInput, guardId: number, post: string): number {
  const plate = input.plate.trim().toUpperCase()
  if (!normPlate(plate)) throw new Error('error.plateRequired')
  const db = conn()
  if (db.prepare('SELECT 1 FROM vehicle_logs WHERE plate_norm = ? AND time_out IS NULL').get(normPlate(plate))) {
    throw new Error('error.vehicleInside')
  }
  const r = db.prepare(`INSERT INTO vehicle_logs (plate, plate_norm, vehicle_type, color, driver_name, company, passengers, cargo,
    notes, photo_enc, time_in, guard_in, post, custom_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    plate, normPlate(plate), input.vehicleType, input.color.trim(), input.driverName.trim(), input.company.trim(),
    Math.max(0, Math.round(Number(input.passengers) || 0)), input.cargo.trim(), input.notes.trim(),
    input.photo ? encrypt(Buffer.from(input.photo)) : null, now(), guardId, post, JSON.stringify(input.custom ?? {})
  )
  return Number(r.lastInsertRowid)
}

export function vehicleOut(id: number, guardId: number, note: string): void {
  const db = conn()
  const v = db.prepare('SELECT notes, time_out FROM vehicle_logs WHERE id = ?').get(id) as { notes: string; time_out: string | null } | undefined
  if (!v) throw new Error('error.notFound')
  if (v.time_out) throw new Error('error.alreadyOut')
  const notes = note.trim() ? [v.notes, note.trim()].filter(Boolean).join(' | ') : v.notes
  db.prepare('UPDATE vehicle_logs SET time_out = ?, guard_out = ?, notes = ? WHERE id = ?').run(now(), guardId, notes, id)
}

export function vehiclesInside(): VehicleRow[] {
  return (conn().prepare(`${SELECT} WHERE l.time_out IS NULL ORDER BY l.time_in DESC`).all() as unknown as VehicleDb[]).map(toRow)
}

export function searchVehicles(q: RangeQuery): VehicleRow[] {
  const where = ['l.time_in BETWEEN ? AND ?']
  const params: string[] = [dayStart(q.from), dayEnd(q.to)]
  const text = q.text.trim()
  if (text) {
    const like = `%${text}%`
    where.push('(l.plate_norm LIKE ? OR l.driver_name LIKE ? OR l.company LIKE ? OR l.cargo LIKE ? OR l.notes LIKE ? OR l.color LIKE ? OR l.custom_json LIKE ?)')
    params.push(`%${normPlate(text)}%`, like, like, like, like, like, like)
  }
  return (conn().prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY l.time_in DESC LIMIT 5000`).all(...params) as unknown as VehicleDb[]).map(toRow)
}

export function vehiclePhoto(id: number): Uint8Array | null {
  const r = conn().prepare('SELECT photo_enc FROM vehicle_logs WHERE id = ?').get(id) as { photo_enc: Uint8Array | null } | undefined
  const buf = decryptBuffer(r?.photo_enc)
  return buf ? new Uint8Array(buf) : null
}
