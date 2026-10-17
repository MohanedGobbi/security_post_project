import type { ActivityItem, RangeQuery, ShiftRow, ShiftState, ShiftSummary } from '@shared/types'
import { audit, conn, dayEnd, dayStart, now, todayLocal } from './db'

interface ShiftDb {
  id: number; user_id: number; guard: string; post: string; started_at: string; ended_at: string | null
  handover_note: string; ack_name: string | null
}

const SELECT = `
SELECT s.id, s.user_id, u.name AS guard, s.post, s.started_at, s.ended_at, s.handover_note, a.name AS ack_name
FROM shifts s
JOIN users u ON u.id = s.user_id
LEFT JOIN users a ON a.id = s.acknowledged_by`

const toRow = (r: ShiftDb): ShiftRow => ({
  id: r.id, userId: r.user_id, guard: r.guard, post: r.post, startedAt: r.started_at, endedAt: r.ended_at,
  handoverNote: r.handover_note, acknowledgedBy: r.ack_name
})

const openShiftOf = (userId: number): ShiftRow | null => {
  const r = conn().prepare(`${SELECT} WHERE s.user_id = ? AND s.ended_at IS NULL ORDER BY s.started_at DESC LIMIT 1`).get(userId) as ShiftDb | undefined
  return r ? toRow(r) : null
}

const lastEnded = (): ShiftRow | null => {
  const r = conn().prepare(`${SELECT} WHERE s.ended_at IS NOT NULL ORDER BY s.ended_at DESC LIMIT 1`).get() as ShiftDb | undefined
  return r ? toRow(r) : null
}

export function shiftSummary(from: string, to: string): ShiftSummary {
  const db = conn()
  const n = (sql: string, ...p: string[]): number => (db.prepare(sql).get(...p) as { n: number }).n
  return {
    visitorsIn: n('SELECT COUNT(*) AS n FROM visits WHERE time_in BETWEEN ? AND ?', from, to),
    visitorsOut: n('SELECT COUNT(*) AS n FROM visits WHERE time_out BETWEEN ? AND ?', from, to),
    vehiclesIn: n('SELECT COUNT(*) AS n FROM vehicle_logs WHERE time_in BETWEEN ? AND ?', from, to),
    vehiclesOut: n('SELECT COUNT(*) AS n FROM vehicle_logs WHERE time_out BETWEEN ? AND ?', from, to),
    parcelsReceived: n('SELECT COALESCE(SUM(parcels), 0) AS n FROM deliveries WHERE time BETWEEN ? AND ?', from, to),
    parcelsPickedUp: n('SELECT COALESCE(SUM(parcels), 0) AS n FROM deliveries WHERE picked_up_at BETWEEN ? AND ?', from, to),
    incidents: n('SELECT COUNT(*) AS n FROM incidents WHERE occurred_at BETWEEN ? AND ?', from, to),
    notes: n('SELECT COUNT(*) AS n FROM notes WHERE time BETWEEN ? AND ?', from, to),
    patrols: n('SELECT COUNT(*) AS n FROM patrol_rounds WHERE ended_at BETWEEN ? AND ?', from, to),
    insideNow: n('SELECT COUNT(*) AS n FROM visits WHERE time_out IS NULL'),
    vehiclesInside: n('SELECT COUNT(*) AS n FROM vehicle_logs WHERE time_out IS NULL'),
    parcelsWaiting: n('SELECT COALESCE(SUM(parcels), 0) AS n FROM deliveries WHERE picked_up_at IS NULL'),
    openIncidents: n('SELECT COUNT(*) AS n FROM incidents WHERE closed_at IS NULL'),
    keysOut: n('SELECT COUNT(*) AS n FROM key_loans WHERE returned_at IS NULL')
  }
}

export function shiftState(userId: number): ShiftState {
  const mine = openShiftOf(userId)
  const previous = lastEnded()
  const othersOpen = (conn().prepare(`${SELECT} WHERE s.ended_at IS NULL AND s.user_id <> ? ORDER BY s.started_at`).all(userId) as unknown as ShiftDb[]).map(toRow)
  const from = mine?.startedAt ?? previous?.startedAt ?? dayStart(todayLocal())
  const to = mine ? now() : previous?.endedAt ?? now()
  return { mine, previous, othersOpen, summary: shiftSummary(from, to) }
}

/** Starts the guard's shift. Shifts left open by other guards are closed (they forgot to end them). */
export function startShift(userId: number, post: string): ShiftRow {
  const existing = openShiftOf(userId)
  if (existing) return existing
  const db = conn()
  const time = now()
  const forgotten = db.prepare('SELECT id FROM shifts WHERE ended_at IS NULL').all() as { id: number }[]
  for (const s of forgotten) {
    db.prepare('UPDATE shifts SET ended_at = ? WHERE id = ?').run(time, s.id)
    audit(userId, 'shift_auto_end', 'shift', s.id)
  }
  const prev = lastEnded()
  if (prev && prev.userId !== userId && !prev.acknowledgedBy) db.prepare('UPDATE shifts SET acknowledged_by = ? WHERE id = ?').run(userId, prev.id)
  const r = db.prepare('INSERT INTO shifts (user_id, post, started_at) VALUES (?, ?, ?)').run(userId, post, time)
  return toRow(db.prepare(`${SELECT} WHERE s.id = ?`).get(Number(r.lastInsertRowid)) as unknown as ShiftDb)
}

export function endShift(userId: number, handoverNote: string): ShiftRow {
  const mine = openShiftOf(userId)
  if (!mine) throw new Error('error.noShift')
  const db = conn()
  db.prepare('UPDATE shifts SET ended_at = ?, handover_note = ? WHERE id = ?').run(now(), handoverNote.trim(), mine.id)
  return toRow(db.prepare(`${SELECT} WHERE s.id = ?`).get(mine.id) as unknown as ShiftDb)
}

export function getShift(id: number): ShiftRow {
  const r = conn().prepare(`${SELECT} WHERE s.id = ?`).get(id) as ShiftDb | undefined
  if (!r) throw new Error('error.notFound')
  return toRow(r)
}

export function listShifts(q: RangeQuery): ShiftRow[] {
  const params: string[] = [dayStart(q.from), dayEnd(q.to)]
  let extra = ''
  if (q.text.trim()) {
    extra = ' AND (u.name LIKE ? OR s.handover_note LIKE ?)'
    params.push(`%${q.text.trim()}%`, `%${q.text.trim()}%`)
  }
  return (conn().prepare(`${SELECT} WHERE s.started_at BETWEEN ? AND ?${extra} ORDER BY s.started_at DESC LIMIT 2000`).all(...params) as unknown as ShiftDb[]).map(toRow)
}

/**
 * Everything that happened between two instants, oldest first: the content of the Daily Activity Report.
 * For incidents and notes, `title` is the type / category key (translated by the caller).
 */
export function activity(from: string, to: string | null): ActivityItem[] {
  const sql = `
    SELECT v.time_in AS time, 'visit_in' AS kind, p.full_name AS title, v.host AS detail, u.name AS guard
      FROM visits v JOIN persons p ON p.id = v.person_id JOIN users u ON u.id = v.guard_in WHERE v.time_in BETWEEN $from AND $to
    UNION ALL SELECT v.time_out, 'visit_out', p.full_name, v.notes, u.name
      FROM visits v JOIN persons p ON p.id = v.person_id JOIN users u ON u.id = v.guard_out WHERE v.time_out BETWEEN $from AND $to
    UNION ALL SELECT l.time_in, 'vehicle_in', l.plate, TRIM(l.driver_name || ' ' || l.company), u.name
      FROM vehicle_logs l JOIN users u ON u.id = l.guard_in WHERE l.time_in BETWEEN $from AND $to
    UNION ALL SELECT l.time_out, 'vehicle_out', l.plate, l.driver_name, u.name
      FROM vehicle_logs l JOIN users u ON u.id = l.guard_out WHERE l.time_out BETWEEN $from AND $to
    UNION ALL SELECT d.time, 'delivery', d.recipient, TRIM(d.carrier || ' ×' || d.parcels), u.name
      FROM deliveries d JOIN users u ON u.id = d.guard_id WHERE d.time BETWEEN $from AND $to
    UNION ALL SELECT d.picked_up_at, 'pickup', d.recipient, d.picked_up_by, u.name
      FROM deliveries d JOIN users u ON u.id = d.guard_pickup WHERE d.picked_up_at BETWEEN $from AND $to
    UNION ALL SELECT i.occurred_at, 'incident', i.type, TRIM(i.location || ' — ' || i.description, ' —'), u.name
      FROM incidents i JOIN users u ON u.id = i.guard_id WHERE i.occurred_at BETWEEN $from AND $to
    UNION ALL SELECT i.closed_at, 'incident_closed', i.type, i.resolution, u.name
      FROM incidents i JOIN users u ON u.id = i.closed_by WHERE i.closed_at BETWEEN $from AND $to
    UNION ALL SELECT n.time, 'note', n.category, n.text, u.name
      FROM notes n JOIN users u ON u.id = n.guard_id WHERE n.time BETWEEN $from AND $to
    UNION ALL SELECT r.ended_at, 'patrol',
        (SELECT COUNT(*) FROM patrol_checks c WHERE c.round_id = r.id) || ' / ' ||
        (SELECT COUNT(*) FROM checkpoints k WHERE k.active = 1 OR k.id IN (SELECT checkpoint_id FROM patrol_checks WHERE round_id = r.id)),
        TRIM(COALESCE((SELECT GROUP_CONCAT(k.name || ': ' || c.note, ' · ') FROM patrol_checks c JOIN checkpoints k ON k.id = c.checkpoint_id
          WHERE c.round_id = r.id AND c.status = 'issue'), '') || ' ' || r.note), u.name
      FROM patrol_rounds r JOIN users u ON u.id = r.guard_id WHERE r.ended_at BETWEEN $from AND $to
    UNION ALL SELECT l.out_at, 'key_out', i.label, l.borrower, u.name
      FROM key_loans l JOIN key_items i ON i.id = l.item_id JOIN users u ON u.id = l.guard_out WHERE l.out_at BETWEEN $from AND $to
    UNION ALL SELECT l.returned_at, 'key_in', i.label, l.borrower, u.name
      FROM key_loans l JOIN key_items i ON i.id = l.item_id JOIN users u ON u.id = l.guard_in WHERE l.returned_at BETWEEN $from AND $to
    UNION ALL SELECT s.started_at, 'shift_start', u.name, s.post, u.name
      FROM shifts s JOIN users u ON u.id = s.user_id WHERE s.started_at BETWEEN $from AND $to
    UNION ALL SELECT s.ended_at, 'shift_end', u.name, s.handover_note, u.name
      FROM shifts s JOIN users u ON u.id = s.user_id WHERE s.ended_at BETWEEN $from AND $to
    ORDER BY time`
  return conn().prepare(sql).all({ from, to: to ?? now() }) as unknown as ActivityItem[]
}
