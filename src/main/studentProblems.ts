import type { QrCheck, Student, StudentCheck } from '@shared/types'
import { compareStudent, readStudentQr } from '@shared/studentQr'
import { conn } from './db'
import { listStudents, studentsByName, studentsByNumber } from './students'

/**
 * Student problems: a student who forgot or lost their card shows the digital card on their phone. Its QR is read as text and
 * compared with the student directory; the guard then records the problem in the "student problems" register.
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

/** What the QR says, and the students it matches: by a number in it first, otherwise by the name it gives. */
export function checkQr(text: string): QrCheck {
  const raw = String(text ?? '').slice(0, 4000)
  const { fields, numbers } = readStudentQr(raw)
  const seen = new Set<number>()
  const matches: StudentCheck[] = []
  for (const n of numbers) {
    for (const s of studentsByNumber(n)) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      // the number found in the QR is the card number it gives, even when the QR does not name it
      matches.push(checkOf(s, 'number', 1, { ...fields, studentNo: fields.studentNo || n }))
    }
  }
  if (!matches.length && fields.fullName) {
    for (const { student, score } of studentsByName(fields.fullName, 0.8, 3)) matches.push(checkOf(student, 'name', score, fields))
  }
  return { text: raw, found: fields, matches }
}

/** Students found by a typed name or card number (when the QR cannot be read), with their recent problems. */
export function searchStudents(text: string): StudentCheck[] {
  const q = String(text ?? '').trim()
  if (q.length < 2) return []
  return listStudents({ text: q, includeInactive: false }).slice(0, 20).map((m) => checkOf(m.student, m.exact ? 'number' : 'name', m.score))
}
