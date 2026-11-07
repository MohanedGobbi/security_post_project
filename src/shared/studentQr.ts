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

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** a link or a path ("…/checkInscription/c194b40e-…"): its letters are not a name */
export const looksLikeLink = (text: string): boolean => {
  const t = text.trim()
  return /^(https?:\/\/|www\.|\/)/i.test(t) || (/[/?&=]/.test(t) && !/\s/.test(t))
}

/**
 * The codes a card gives that are not a number of the directory: the registration code of a digital card
 * (its QR is "…/checkInscription/<uuid>"), or a long token of letters and digits read by a scanner (UN3001…).
 * The program learns which student each one belongs to (see studentProblems.ts).
 */
export function cardCodes(text: string): string[] {
  const t = text.trim()
  const out = (t.match(UUID) ?? []).map((u) => u.toLowerCase())
  for (const tok of t.split(/[/?&=#\s,;|]+/)) {
    if (tok.length >= 8 && tok.length <= 64 && /\d/.test(tok) && /[a-z]/i.test(tok) && !tok.includes('.') && !IS_UUID.test(tok)) out.push(tok.toUpperCase())
  }
  // the whole text, when it is one short code (a barcode, a typed code)
  if (!out.length && /^[A-Z0-9-]{6,40}$/i.test(t) && /\d/.test(t)) out.push(t.toUpperCase())
  return [...new Set(out)]
}

/** long digit runs, and their ends: a printed number like UN3001202622239294218 may hold the card number at its end */
function numbersIn(text: string, studentNo: string): string[] {
  const runs = [studentNo.replace(/\D/g, ''), ...(text.replace(UUID, ' ').match(/\d{6,24}/g) ?? [])].filter((n) => n.length >= 6)
  const out: string[] = []
  for (const r of runs) {
    out.push(r)
    if (r.length >= 10) for (let n = Math.min(16, r.length - 1); n >= 8; n--) out.push(r.slice(-n))
  }
  return [...new Set(out)]
}

/** What the QR says about the student. */
export function readStudentQr(text: string): { fields: QrStudentFields; numbers: string[]; codes: string[] } {
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
  // plain text without fields (and not a link): the letters in it may be the name
  if (!pairs.length && !f.fullName && !looksLikeLink(text)) {
    const letters = text.replace(/[^\p{L}\s]+/gu, ' ').replace(/\s+/g, ' ').trim()
    if (letters.split(' ').length >= 2 && letters.length <= 80) f.fullName = letters
  }
  return { fields: f, numbers: numbersIn(text, f.studentNo), codes: cardCodes(text) }
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
