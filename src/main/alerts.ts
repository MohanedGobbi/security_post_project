import type { AlertItem } from '@shared/types'
import { conn, getFeatures, getSettings, todayLocal } from './db'
import { overdueLoans } from './keys'
import { lastRoundEnd, listCheckpoints } from './patrols'

const HOUR = 3600000

/** Everything that needs the guard's attention now. Computed on demand, nothing is stored. */
export function currentAlerts(): AlertItem[] {
  const s = getSettings()
  const on = getFeatures().modules
  const db = conn()
  const out: AlertItem[] = []
  const nowMs = Date.now()

  // closing time today, in local time
  let closing: number | null = null
  if (s.closingTime) {
    const c = new Date(`${todayLocal()}T${s.closingTime}:00`).getTime()
    if (nowMs > c) closing = c
  }

  if (s.overstayHours > 0 || closing !== null) {
    const inside = db.prepare(`SELECT v.id, p.full_name, v.host, v.time_in FROM visits v JOIN persons p ON p.id = v.person_id
      WHERE v.time_out IS NULL ORDER BY v.time_in`).all() as { id: number; full_name: string; host: string; time_in: string }[]
    for (const v of inside) {
      const tIn = new Date(v.time_in).getTime()
      if (s.overstayHours > 0 && nowMs - tIn > s.overstayHours * HOUR) {
        out.push({ kind: 'visitor_overstay', refId: v.id, title: v.full_name, detail: v.host, since: v.time_in })
      } else if (closing !== null) {
        out.push({ kind: 'visitor_after_closing', refId: v.id, title: v.full_name, detail: v.host, since: v.time_in })
      }
    }
  }

  if (on.vehicles && s.vehicleOverstayHours > 0) {
    const cutoff = new Date(nowMs - s.vehicleOverstayHours * HOUR).toISOString()
    const rows = db.prepare(`SELECT id, plate, driver_name, time_in FROM vehicle_logs WHERE time_out IS NULL AND time_in < ? ORDER BY time_in`)
      .all(cutoff) as { id: number; plate: string; driver_name: string; time_in: string }[]
    for (const v of rows) out.push({ kind: 'vehicle_overstay', refId: v.id, title: v.plate, detail: v.driver_name, since: v.time_in })
  }

  if (on.keys) for (const l of overdueLoans()) out.push({ kind: 'key_overdue', refId: l.id, title: l.itemLabel, detail: l.borrower, since: l.dueAt })

  if (on.patrols && s.patrolIntervalHours > 0 && listCheckpoints(false).length > 0) {
    const last = lastRoundEnd()
    if (!last || nowMs - new Date(last).getTime() > s.patrolIntervalHours * HOUR) {
      out.push({ kind: 'patrol_due', refId: null, title: '', detail: '', since: last })
    }
  }
  return out
}
