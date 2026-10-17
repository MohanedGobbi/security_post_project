import type { KeyItem, KeyItemInput, KeyKind, KeyLoan, LendInput, RangeQuery } from '@shared/types'
import { conn, dayEnd, dayStart, now } from './db'

const KINDS: KeyKind[] = ['key', 'badge', 'radio', 'equipment', 'other']

interface ItemDb { id: number; label: string; kind: KeyKind; code: string; location: string; active: number }
interface LoanDb {
  id: number; item_id: number; item_label: string; borrower: string; borrower_info: string; out_at: string; due_at: string | null
  returned_at: string | null; guard_out_name: string; guard_in_name: string | null; notes: string
}

const LOAN_SELECT = `
SELECT l.id, l.item_id, i.label AS item_label, l.borrower, l.borrower_info, l.out_at, l.due_at, l.returned_at,
  go.name AS guard_out_name, gi.name AS guard_in_name, l.notes
FROM key_loans l
JOIN key_items i ON i.id = l.item_id
JOIN users go ON go.id = l.guard_out
LEFT JOIN users gi ON gi.id = l.guard_in`

const toLoan = (r: LoanDb): KeyLoan => ({
  id: r.id, itemId: r.item_id, itemLabel: r.item_label, borrower: r.borrower, borrowerInfo: r.borrower_info, outAt: r.out_at,
  dueAt: r.due_at, returnedAt: r.returned_at, guardOut: r.guard_out_name, guardIn: r.guard_in_name, notes: r.notes
})

export function listItems(includeInactive: boolean): KeyItem[] {
  const db = conn()
  const items = db.prepare(`SELECT * FROM key_items ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY label COLLATE NOCASE`).all() as unknown as ItemDb[]
  const open = new Map((db.prepare(`${LOAN_SELECT} WHERE l.returned_at IS NULL`).all() as unknown as LoanDb[]).map((l) => [l.item_id, toLoan(l)]))
  return items.map((i) => ({ id: i.id, label: i.label, kind: i.kind, code: i.code, location: i.location, active: i.active === 1, loan: open.get(i.id) ?? null }))
}

export function addItem(input: KeyItemInput): number {
  if (!input.label.trim()) throw new Error('error.nameRequired')
  const r = conn().prepare('INSERT INTO key_items (label, kind, code, location) VALUES (?, ?, ?, ?)').run(
    input.label.trim(), KINDS.includes(input.kind) ? input.kind : 'other', input.code.trim(), input.location.trim()
  )
  return Number(r.lastInsertRowid)
}

export function setItemActive(id: number, active: boolean): void {
  conn().prepare('UPDATE key_items SET active = ? WHERE id = ?').run(active ? 1 : 0, id)
}

export function lend(itemId: number, input: LendInput, guardId: number): number {
  if (!input.borrower.trim()) throw new Error('error.borrowerRequired')
  const db = conn()
  const item = db.prepare('SELECT active FROM key_items WHERE id = ?').get(itemId) as { active: number } | undefined
  if (!item || item.active !== 1) throw new Error('error.notFound')
  if (db.prepare('SELECT 1 FROM key_loans WHERE item_id = ? AND returned_at IS NULL').get(itemId)) throw new Error('error.keyOut')
  const due = input.dueAt ? new Date(input.dueAt) : null
  const r = db.prepare('INSERT INTO key_loans (item_id, borrower, borrower_info, out_at, due_at, guard_out, notes) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    itemId, input.borrower.trim(), input.borrowerInfo.trim(), now(), due && !Number.isNaN(due.getTime()) ? due.toISOString() : null, guardId, input.notes.trim()
  )
  return Number(r.lastInsertRowid)
}

export function giveBack(loanId: number, note: string, guardId: number): void {
  const db = conn()
  const l = db.prepare('SELECT returned_at, notes FROM key_loans WHERE id = ?').get(loanId) as { returned_at: string | null; notes: string } | undefined
  if (!l) throw new Error('error.notFound')
  if (l.returned_at) throw new Error('error.alreadyReturned')
  const notes = note.trim() ? [l.notes, note.trim()].filter(Boolean).join(' | ') : l.notes
  db.prepare('UPDATE key_loans SET returned_at = ?, guard_in = ?, notes = ? WHERE id = ?').run(now(), guardId, notes, loanId)
}

export function searchLoans(q: RangeQuery): KeyLoan[] {
  const where = ['l.out_at BETWEEN ? AND ?']
  const params: string[] = [dayStart(q.from), dayEnd(q.to)]
  if (q.text.trim()) {
    const like = `%${q.text.trim()}%`
    where.push('(i.label LIKE ? OR i.code LIKE ? OR l.borrower LIKE ? OR l.borrower_info LIKE ? OR l.notes LIKE ?)')
    params.push(like, like, like, like, like)
  }
  return (conn().prepare(`${LOAN_SELECT} WHERE ${where.join(' AND ')} ORDER BY l.out_at DESC LIMIT 5000`).all(...params) as unknown as LoanDb[]).map(toLoan)
}

export function overdueLoans(): KeyLoan[] {
  return (conn().prepare(`${LOAN_SELECT} WHERE l.returned_at IS NULL AND l.due_at IS NOT NULL AND l.due_at < ? ORDER BY l.due_at`).all(now()) as unknown as LoanDb[]).map(toLoan)
}
