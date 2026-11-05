import type { QrCheck, Student, StudentCheck } from '@shared/types'
import { compareStudent, readStudentQr } from '@shared/studentQr'
import { audit, conn } from './db'
import { linkCode, listStudents, studentByCode, studentsByName, studentsByNumber } from './students'

/**
 * Student problems: a student who forgot or lost their card shows the digital card on their phone. Its QR (read by the webcam
 * or typed by a handheld scanner) is read as text and compared with the student directory; the guard then records the problem
 * in the "student problems" register.
 * The QR of the Algerian digital student card holds only a registration code ("/checkInscription/<uuid>"), which the directory
 * does not know: the first time, the guard finds the student by name and the code is learnt, so the next scan finds them.
 */

const RECENT_DAYS = 90

/** entries of the student problems register about this card number in the last 90 days */
function recentProblems(studentNo: string): number {
  if (!studentNo) return 0
  const since = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString()
  const r = conn().prepare(`SELECT COUNT(*) AS n FROM register_entries e JOIN registers r ON r.id = e.register_id
    WHERE r.key = 'student_problems' AND e.created_at >= ? AND upper(replace(json_extract(e.data_json, '$.student_no'), ' ', '')) = ?`)
    .get(since, studentNo.replace(/\s/g, '').toUpperCase()) as { n: number }
  return r.n
}

const checkOf = (student: Student, by: StudentCheck['by'], score: number, found = readStudentQr('').fields): StudentCheck =>
  ({ student, by, score, fields: compareStudent(found, student), recentProblems: recentProblems(student.studentNo) })

/** What the QR says, and the students it matches: by a learnt card code first, then a number in it, then the name it gives. */
export function checkQr(text: string): QrCheck {
  const raw = String(text ?? '').trim().slice(0, 4000)
  const { fields, numbers, codes } = readStudentQr(raw)
  const seen = new Set<number>()
  const matches: StudentCheck[] = []
  const add = (s: Student, c: StudentCheck): void => { if (!seen.has(s.id)) { seen.add(s.id); matches.push(c) } }
  for (const code of codes) {
    const s = studentByCode(code)
    if (s) add(s, checkOf(s, 'code', 1, fields))
  }
  for (const n of numbers) {
    // the number found in the QR is the card number it gives, even when the QR does not name it
    for (const s of studentsByNumber(n)) add(s, checkOf(s, 'number', 1, { ...fields, studentNo: fields.studentNo || n }))
  }
  if (!matches.length && fields.fullName) {
    for (const { student, score } of studentsByName(fields.fullName, 0.8, 3)) add(student, checkOf(student, 'name', score, fields))
  }
  return { text: raw, found: fields, code: codes[0] ?? '', matches }
}

/** Students found by a typed name or card number (when the QR cannot be read), with their recent problems. */
export function searchStudents(text: string): StudentCheck[] {
  const q = String(text ?? '').trim()
  if (q.length < 2) return []
  return listStudents({ text: q, includeInactive: false }).slice(0, 20).map((m) => checkOf(m.student, m.exact ? 'number' : 'name', m.score))
}

/** Learns a card code for a student the guard identified (by search), so the next scan of that card finds them. */
export function learnCode(studentId: number, code: string, userId: number): void {
  const c = String(code ?? '').trim()
  if (!c) return
  linkCode(Number(studentId), c, userId)
  audit(userId, 'student_code_learnt', 'student', Number(studentId))
}
