import { writeFile } from 'node:fs/promises'
import type { BrowserWindow } from 'electron'
import { ATTENDANCE_STATUSES, type AttendanceMarkInput, type AttendanceMonthRow, type AttendanceRow, type AttendanceStatus, type Lang, type StaffInput, type StaffMember, type User } from '@shared/types'
import { audit, conn, now } from './db'
import { askSavePath, htmlToPdf, registerSignatures, reportHtml, section, tr } from './export'

/**
 * Attendance of the security team. The team leader marks each member by hand for each day (present, late, absent, leave,
 * sick, on a mission); a mark can be changed, and every change is in the audit trail. The dean reads and prints it.
 */

const clean = (s: unknown, max = 120): string => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const isDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s)
const isTime = (s: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
const today = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface StaffDb { id: number; name: string; job_title: string; start_time: string }
const toStaff = (r: StaffDb): StaffMember => ({ id: r.id, name: r.name, jobTitle: r.job_title, startTime: r.start_time })

export function listStaff(): StaffMember[] {
  return (conn().prepare('SELECT id, name, job_title, start_time FROM staff WHERE active = 1 ORDER BY name').all() as unknown as StaffDb[]).map(toStaff)
}

export function saveStaff(input: StaffInput, user: User): number {
  const name = clean(input.name)
  if (!name) throw new Error('error.nameRequired')
  const jobTitle = clean(input.jobTitle)
  const startTime = isTime(String(input.startTime ?? '')) ? String(input.startTime) : ''
  const db = conn()
  if (input.id) {
    if (!db.prepare('SELECT id FROM staff WHERE id = ? AND active = 1').get(input.id)) throw new Error('error.notFound')
    db.prepare('UPDATE staff SET name = ?, job_title = ?, start_time = ? WHERE id = ?').run(name, jobTitle, startTime, input.id)
    audit(user.id, 'staff_updated', 'staff', input.id, name)
    return input.id
  }
  if (db.prepare('SELECT id FROM staff WHERE active = 1 AND lower(name) = lower(?)').get(name)) throw new Error('error.staffExists')
  const id = Number(db.prepare('INSERT INTO staff (name, job_title, start_time, created_by, created_at) VALUES (?, ?, ?, ?, ?)').run(name, jobTitle, startTime, user.id, now()).lastInsertRowid)
  audit(user.id, 'staff_added', 'staff', id, name)
  return id
}

/** Takes a member off the list; their past marks stay in the database. */
export function removeStaff(id: number, user: User): void {
  const row = conn().prepare('SELECT name FROM staff WHERE id = ? AND active = 1').get(id) as { name: string } | undefined
  if (!row) throw new Error('error.notFound')
  conn().prepare('UPDATE staff SET active = 0 WHERE id = ?').run(id)
  audit(user.id, 'staff_removed', 'staff', id, row.name)
}

interface MarkDb { staff_id: number; status: AttendanceStatus; arrived_at: string; note: string; marked_at: string; by: string | null }

export function dayRows(date: string): AttendanceRow[] {
  if (!isDate(date)) throw new Error('error.invalidDate')
  const marks = new Map((conn().prepare(
    'SELECT a.staff_id, a.status, a.arrived_at, a.note, a.marked_at, u.name AS by FROM attendance a LEFT JOIN users u ON u.id = a.marked_by WHERE a.day = ?'
  ).all(date) as unknown as MarkDb[]).map((m) => [m.staff_id, m]))
  return listStaff().map((staff) => {
    const m = marks.get(staff.id)
    return { staff, mark: m ? { status: m.status, arrivedAt: m.arrived_at, note: m.note, markedBy: m.by ?? '', markedAt: m.marked_at } : null }
  })
}

export function markAttendance(input: AttendanceMarkInput, user: User): void {
  if (!isDate(input.date) || input.date > today()) throw new Error('error.invalidDate')
  if (!ATTENDANCE_STATUSES.includes(input.status)) throw new Error('error.invalid')
  const db = conn()
  const staff = db.prepare('SELECT name, start_time FROM staff WHERE id = ? AND active = 1').get(input.staffId) as { name: string; start_time: string } | undefined
  if (!staff) throw new Error('error.notFound')
  const arrivedAt = isTime(String(input.arrivedAt ?? '')) && (input.status === 'present' || input.status === 'late') ? String(input.arrivedAt) : ''
  // a member who arrived after their start time is late, whatever was ticked
  const status: AttendanceStatus = input.status === 'present' && arrivedAt && staff.start_time && arrivedAt > staff.start_time ? 'late' : input.status
  const before = db.prepare('SELECT status FROM attendance WHERE staff_id = ? AND day = ?').get(input.staffId, input.date) as { status: string } | undefined
  db.prepare(
    `INSERT INTO attendance (staff_id, day, status, arrived_at, note, marked_by, marked_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(staff_id, day) DO UPDATE SET status = excluded.status, arrived_at = excluded.arrived_at, note = excluded.note, marked_by = excluded.marked_by, marked_at = excluded.marked_at`
  ).run(input.staffId, input.date, status, arrivedAt, clean(input.note, 300), user.id, now())
  audit(user.id, before ? 'attendance_changed' : 'attendance_marked', 'staff', input.staffId, `${staff.name} · ${input.date} · ${before ? `${before.status} → ` : ''}${status}`)
}

export function markAllPresent(date: string, user: User): number {
  if (!isDate(date) || date > today()) throw new Error('error.invalidDate')
  let n = 0
  for (const r of dayRows(date)) {
    if (r.mark) continue
    markAttendance({ staffId: r.staff.id, date, status: 'present', arrivedAt: '', note: '' }, user)
    n++
  }
  return n
}

export function monthRows(month: string): AttendanceMonthRow[] {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('error.invalidDate')
  const counts = conn().prepare(
    'SELECT staff_id, status, COUNT(*) AS n FROM attendance WHERE day >= ? AND day <= ? GROUP BY staff_id, status'
  ).all(`${month}-01`, `${month}-31`) as unknown as { staff_id: number; status: AttendanceStatus; n: number }[]
  return listStaff().map((staff) => {
    const c = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0])) as Record<AttendanceStatus, number>
    for (const r of counts) if (r.staff_id === staff.id) c[r.status] = r.n
    return { staff, counts: c }
  })
}

// ---------- printouts ----------
async function savePdf(parent: BrowserWindow | null, name: string, html: string): Promise<string | null> {
  const pdf = await htmlToPdf(html, false)
  const path = await askSavePath(parent, name, 'pdf')
  if (!path) return null
  await writeFile(path, pdf)
  return path
}

export function dayPdf(parent: BrowserWindow | null, date: string, lang: Lang, user: User): Promise<string | null> {
  const t = tr(lang)
  const sec = section(t('attendance.title'), [
    { label: t('attendance.name'), value: (r: AttendanceRow) => r.staff.name },
    { label: t('attendance.jobTitle'), value: (r: AttendanceRow) => r.staff.jobTitle },
    { label: t('attendance.status'), value: (r: AttendanceRow) => (r.mark ? t(`attendance.s.${r.mark.status}`) : t('attendance.notMarked')) },
    { label: t('attendance.arrived'), value: (r: AttendanceRow) => r.mark?.arrivedAt ?? '' },
    { label: t('attendance.note'), value: (r: AttendanceRow) => r.mark?.note ?? '' },
    { label: t('attendance.markedBy'), value: (r: AttendanceRow) => r.mark?.markedBy ?? '' }
  ], dayRows(date))
  const html = reportHtml(lang, t('attendance.dayTitle'), date, [sec], user.name, '', false, registerSignatures(lang))
  return savePdf(parent, `attendance_${date}.pdf`, html)
}

export function monthPdf(parent: BrowserWindow | null, month: string, lang: Lang, user: User): Promise<string | null> {
  const t = tr(lang)
  const sec = section(t('attendance.monthTitle'), [
    { label: t('attendance.name'), value: (r: AttendanceMonthRow) => r.staff.name },
    { label: t('attendance.jobTitle'), value: (r: AttendanceMonthRow) => r.staff.jobTitle },
    ...ATTENDANCE_STATUSES.map((s) => ({ label: t(`attendance.s.${s}`), value: (r: AttendanceMonthRow) => String(r.counts[s]) }))
  ], monthRows(month))
  const html = reportHtml(lang, t('attendance.monthTitle'), month, [sec], user.name, '', false, registerSignatures(lang))
  return savePdf(parent, `attendance_${month}.pdf`, html)
}
