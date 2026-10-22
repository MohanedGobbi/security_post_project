import { randomBytes } from 'node:crypto'
import type { ExpectedInput, ExpectedVisitor } from '@shared/types'
import { conn, now, todayLocal } from './db'

interface ExpectedDb {
  id: number; ref_code: string; full_name: string; company: string; host: string; purpose: string; phone: string
  valid_from: string; valid_to: string; notes: string; status: ExpectedVisitor['status']; arrived_at: string | null; visit_id: number | null
}

const toRow = (r: ExpectedDb): ExpectedVisitor => ({
  id: r.id, refCode: r.ref_code, fullName: r.full_name, company: r.company, host: r.host, purpose: r.purpose, phone: r.phone,
  validFrom: r.valid_from, validTo: r.valid_to, notes: r.notes, status: r.status,
  arrivedAt: r.arrived_at, visitId: r.visit_id
})

const isDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s)

/** Today and the next 14 days, plus visitors who arrived today */
export function listExpected(): ExpectedVisitor[] {
  const t = todayLocal()
  const until = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  return (conn().prepare(`SELECT * FROM expected_visits WHERE valid_to >= ? AND valid_from <= ? AND status <> 'cancelled'
    ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, valid_from, full_name`).all(t, until) as unknown as ExpectedDb[]).map(toRow)
}

/** Unambiguous 6-character code (no 0/O/1/I) */
function newRef(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = ''
  do {
    ref = [...randomBytes(6)].map((b) => alphabet[b % alphabet.length]).join('')
  } while (conn().prepare('SELECT 1 FROM expected_visits WHERE ref_code = ?').get(ref))
  return ref
}

export function addExpected(input: ExpectedInput, userId: number): number {
  if (!input.fullName.trim()) throw new Error('error.nameRequired')
  const from = isDate(input.validFrom) ? input.validFrom : todayLocal()
  const to = isDate(input.validTo) && input.validTo >= from ? input.validTo : from
  const r = conn().prepare(`INSERT INTO expected_visits (ref_code, full_name, company, host, purpose, phone, valid_from, valid_to, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    newRef(), input.fullName.trim(), input.company.trim(), input.host.trim(), input.purpose.trim(), input.phone.trim(), from, to, input.notes.trim(), userId, now()
  )
  return Number(r.lastInsertRowid)
}

export function cancelExpected(id: number): void {
  const r = conn().prepare('SELECT status FROM expected_visits WHERE id = ?').get(id) as { status: string } | undefined
  if (!r) throw new Error('error.notFound')
  if (r.status === 'pending') conn().prepare("UPDATE expected_visits SET status = 'cancelled' WHERE id = ?").run(id)
}

/** From the QR of a pass ("SECREG-P:ABC123") or the code typed by hand */
export function findByRef(text: string): ExpectedVisitor | null {
  const ref = text.trim().toUpperCase().replace(/^SECREG-P:/, '')
  const r = conn().prepare('SELECT * FROM expected_visits WHERE ref_code = ?').get(ref) as ExpectedDb | undefined
  return r ? toRow(r) : null
}

export function getExpected(id: number): ExpectedVisitor | null {
  const r = conn().prepare('SELECT * FROM expected_visits WHERE id = ?').get(id) as ExpectedDb | undefined
  return r ? toRow(r) : null
}

export function markArrived(id: number, visitId: number): void {
  conn().prepare(`UPDATE expected_visits SET status = 'arrived', arrived_at = ?, visit_id = ?
    WHERE id = ? AND status = 'pending'`).run(now(), visitId, id)
}

