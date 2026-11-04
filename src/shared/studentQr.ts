// The QR code of a digital student card, as text: what it says about the student, and how that compares with the directory.
// The card's exact format is not known, so the text is read the way people write such data: JSON, a link with parameters,
// "key: value" lines, or plain text. Any long number in it may be the card number.
import type { FieldCheck, QrStudentFields, Student, StudentCheckKey } from './types'
import { nameSimilarity, normName } from './names'

/** field names as they may appear in the QR (Arabic, French, English), compared without accents, spaces or punctuation */
const ALIASES: Record<StudentCheckKey | 'firstName' | 'lastName', string[]> = {
  studentNo: ['matricule', 'mat', 'numero', 'num', 'numetudiant', 'numeroetudiant', 'ncarte', 'numcarte', 'studentid', 'studentno', 'studentnumber',
    'cardnumber', 'id', 'code', 'رقمالتسجيل', 'رقمالطالب', 'رقمالبطاقة', 'رقمبطاقةالطالب', 'الرقم'],
  fullName: ['nomcomplet', 'nomprenom', 'fullname', 'name', 'etudiant', 'student', 'الاسمواللقب', 'اللقبوالاسم', 'الطالب'],
  lastName: ['nom', 'lastname', 'surname', 'familyname', 'اللقب'],
  firstName: ['prenom', 'firstname', 'givenname', 'الاسم'],
  birthDate: ['datenaissance', 'datedenaissance', 'naissance', 'birthdate', 'dateofbirth', 'dob', 'تاريخالميلاد', 'تاريخالازدياد'],
  level: ['niveau', 'level', 'annee', 'year', 'المستوى', 'السنة'],
  department: ['specialite', 'filiere', 'departement', 'department', 'major', 'domaine', 'التخصص', 'الشعبة', 'القسم']
}

const keyOf = (k: string): string => k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_\-.:'’]/g, '')

function aliasOf(k: string): keyof typeof ALIASES | null {
  const n = keyOf(k)
  for (const [field, list] of Object.entries(ALIASES)) if (list.includes(n)) return field as keyof typeof ALIASES
  return null
}

/** key / value pairs found in the text */
function pairsOf(text: string): [string, string][] {
  const t = text.trim()
  try {
    const obj = JSON.parse(t) as unknown
    if (obj && typeof obj === 'object') {
      const out: [string, string][] = []
      const walk = (o: Record<string, unknown>): void => {
        for (const [k, v] of Object.entries(o)) {
          if (v && typeof v === 'object') walk(v as Record<string, unknown>)
          else if (v != null) out.push([k, String(v)])
        }
      }
      walk(obj as Record<string, unknown>)
      return out
    }
  } catch { /* not JSON */ }
  try {
    const u = new URL(t)
    const params = [...u.searchParams.entries()]
    if (params.length) return params
  } catch { /* not a link */ }
  return t.split(/[\n;|]+/).flatMap((line): [string, string][] => {
    const m = line.match(/^\s*([^:=]{1,40}?)\s*[:=]\s*(.+?)\s*$/)
    return m ? [[m[1], m[2]]] : []
  })
}

/** dd/mm/yyyy, yyyy-mm-dd and the like, as yyyy-mm-dd; '' when it is not a date */
export function isoDate(s: string): string {
  const v = s.trim()
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return ''
}

/** What the QR says about the student. */
export function readStudentQr(text: string): { fields: QrStudentFields; numbers: string[] } {
  const f: QrStudentFields = { studentNo: '', fullName: '', birthDate: '', level: '', department: '' }
  let first = ''
  let last = ''
  const pairs = pairsOf(text)
  for (const [k, v] of pairs) {
    const a = aliasOf(k)
    if (!a || !v.trim()) continue
    if (a === 'firstName') first ||= v.trim()
    else if (a === 'lastName') last ||= v.trim()
    else if (a === 'birthDate') f.birthDate ||= isoDate(v) || v.trim()
    else f[a] ||= v.trim()
  }
  if (!f.fullName && (first || last)) f.fullName = [last, first].filter(Boolean).join(' ')
  // plain text without fields: the letters in it may be the name
  if (!pairs.length && !f.fullName) {
    const letters = text.replace(/[^\p{L}\s]+/gu, ' ').replace(/\s+/g, ' ').trim()
    if (letters.split(' ').length >= 2 && letters.length <= 80) f.fullName = letters
  }
  const numbers = [...new Set([f.studentNo.replace(/\D/g, ''), ...(text.match(/\d{6,20}/g) ?? [])].filter((n) => n.length >= 6))]
  return { fields: f, numbers }
}

const same = (a: string, b: string): boolean => normName(a) === normName(b) || (!!normName(a) && !!normName(b) && (normName(a).includes(normName(b)) || normName(b).includes(normName(a))))

/** The QR's fields next to the student's record in the directory. */
export function compareStudent(found: QrStudentFields, s: Student): FieldCheck[] {
  const name = s.fullNameAlt || s.fullName
  const check = (key: FieldCheck['key'], fromQr: string, inList: string, ok: () => boolean): FieldCheck =>
    ({ key, fromQr, inList, same: fromQr ? ok() : null })
  return [
    check('studentNo', found.studentNo, s.studentNo, () => found.studentNo.replace(/\W/g, '').toUpperCase() === s.studentNo.replace(/\W/g, '').toUpperCase()),
    check('fullName', found.fullName, [s.fullNameAlt, s.fullName].filter(Boolean).join(' / ') || name,
      () => Math.max(nameSimilarity(found.fullName, s.fullName), s.fullNameAlt ? nameSimilarity(found.fullName, s.fullNameAlt) : 0) >= 0.85),
    check('birthDate', found.birthDate, s.birthDate, () => (isoDate(found.birthDate) || found.birthDate) === s.birthDate),
    check('level', found.level, s.level, () => same(found.level, s.level)),
    check('department', found.department, s.department, () => same(found.department, s.department))
  ]
}
