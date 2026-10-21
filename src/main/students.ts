import ExcelJS from 'exceljs'
import type { BrowserWindow } from 'electron'
import type { Lang, Student, StudentImportResult, StudentInput, StudentMatch } from '@shared/types'
import { askSavePath } from './export'
import { nameSimilarity, normName } from '@shared/names'
import { conn, now } from './db'
import { decryptText, encrypt, idHash, normalizeId } from './crypto'

/**
 * The student directory. Names, level and department are stored as text (searchable, like the names of visitors); the card number,
 * national number, birth date and phone are encrypted, and the two numbers are found through a keyed hash, like visitors' ID numbers.
 * A visitor registered with a student's card number (or national number) is that student: the same hash is in both tables.
 */

interface StudentDb {
  id: number; student_no_enc: Uint8Array | null; id_number_enc: Uint8Array | null; full_name: string; full_name_alt: string
  birth_date_enc: Uint8Array | null; phone_enc: Uint8Array | null; level: string; department: string; notes: string; active: number
}

const clean = (s: unknown, max = 200): string => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

const toStudent = (r: StudentDb): Student => ({
  id: r.id, studentNo: decryptText(r.student_no_enc), idNumber: decryptText(r.id_number_enc), fullName: r.full_name, fullNameAlt: r.full_name_alt,
  birthDate: decryptText(r.birth_date_enc), phone: decryptText(r.phone_enc), level: r.level, department: r.department, notes: r.notes, active: r.active === 1
})

const hashOf = (n: string): string | null => (normalizeId(n) ? idHash(n) : null)

/** what the visit log knows about someone with these numbers */
function presence(s: Student): Pick<StudentMatch, 'insideVisitId' | 'insideSince' | 'lastSeen' | 'visitsCount'> {
  const hashes = [hashOf(s.studentNo), hashOf(s.idNumber)].filter((h): h is string => !!h)
  if (!hashes.length) return { insideVisitId: null, insideSince: null, lastSeen: null, visitsCount: 0 }
  const marks = hashes.map(() => '?').join(',')
  const db = conn()
  const stats = db.prepare(`SELECT COUNT(*) AS n, MAX(v.time_in) AS last FROM visits v JOIN persons p ON p.id = v.person_id WHERE p.id_hash IN (${marks})`).get(...hashes) as { n: number; last: string | null }
  const inside = db.prepare(`SELECT v.id, v.time_in FROM visits v JOIN persons p ON p.id = v.person_id WHERE p.id_hash IN (${marks}) AND v.time_out IS NULL ORDER BY v.time_in DESC LIMIT 1`).get(...hashes) as { id: number; time_in: string } | undefined
  return { insideVisitId: inside?.id ?? null, insideSince: inside?.time_in ?? null, lastSeen: stats.last, visitsCount: stats.n }
}

const match = (s: Student, score: number, exact: boolean): StudentMatch => ({ student: s, score, exact, ...presence(s) })

/**
 * Search: a number finds the student with that card or national number; words find names that contain them (any spelling of
 * the Arabic letters, accents ignored). Blank lists the first 200.
 */
export function listStudents(q: { text: string; includeInactive: boolean }): StudentMatch[] {
  const db = conn()
  const text = clean(q.text)
  const activeSql = q.includeInactive ? '' : ' AND active = 1'
  const rows: StudentDb[] = []
  const seen = new Set<number>()
  const byNumber = new Set<number>()
  const take = (found: StudentDb[]): void => { for (const r of found) if (!seen.has(r.id)) { seen.add(r.id); rows.push(r) } }
  if (/\d{3,}/.test(text)) {
    const h = hashOf(text)
    if (h) {
      const hit = db.prepare(`SELECT * FROM students WHERE (student_no_hash = ? OR id_hash = ?)${activeSql}`).all(h, h) as unknown as StudentDb[]
      hit.forEach((r) => byNumber.add(r.id))
      take(hit)
    }
  }
  const words = normName(text).split(' ').filter(Boolean)
  if (words.length || !text) {
    const where = words.map(() => 'name_norm LIKE ?').join(' AND ') || '1 = 1'
    take(db.prepare(`SELECT * FROM students WHERE ${where}${activeSql} ORDER BY full_name_alt, full_name LIMIT 200`).all(...words.map((w) => `%${w}%`)) as unknown as StudentDb[])
  }
  return rows.slice(0, 200).map((r) => match(toStudent(r), 1, byNumber.has(r.id)))
}

/** Students that could be the person at the desk: the same card / ID number first, then alike names (card scans misread letters). */
export function suggestStudents(q: { name: string; idNumber: string }): StudentMatch[] {
  const db = conn()
  const out: StudentMatch[] = []
  const used = new Set<number>()
  const h = hashOf(clean(q.idNumber))
  if (h) {
    for (const r of db.prepare('SELECT * FROM students WHERE (student_no_hash = ? OR id_hash = ?) AND active = 1').all(h, h) as unknown as StudentDb[]) {
      used.add(r.id)
      out.push(match(toStudent(r), 1, true))
    }
  }
  const name = clean(q.name)
  if (normName(name).replace(/ /g, '').length >= 3) {
    const rows = db.prepare('SELECT id, full_name, full_name_alt FROM students WHERE active = 1').all() as unknown as { id: number; full_name: string; full_name_alt: string }[]
    const scored = rows
      .filter((r) => !used.has(r.id))
      .map((r) => ({ id: r.id, score: Math.max(nameSimilarity(name, r.full_name), r.full_name_alt ? nameSimilarity(name, r.full_name_alt) : 0) }))
      .filter((r) => r.score >= 0.72)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
    for (const s of scored) {
      const r = db.prepare('SELECT * FROM students WHERE id = ?').get(s.id) as unknown as StudentDb
      out.push(match(toStudent(r), s.score, false))
    }
  }
  return out.slice(0, 5)
}

export const studentCount = (): number => (conn().prepare('SELECT COUNT(*) AS n FROM students WHERE active = 1').get() as { n: number }).n

function cleanInput(i: StudentInput): StudentInput {
  const fullName = clean(i.fullName)
  const fullNameAlt = clean(i.fullNameAlt)
  if (!fullName && !fullNameAlt) throw new Error('error.nameRequired')
  const birth = clean(i.birthDate, 10)
  return {
    id: i.id, studentNo: clean(i.studentNo, 40), idNumber: clean(i.idNumber, 40), fullName, fullNameAlt,
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth : '', phone: clean(i.phone, 30), level: clean(i.level, 40), department: clean(i.department, 80),
    notes: clean(i.notes, 500), active: i.active
  }
}

/** Adds a student, or updates the one with this id (or, for an import, the one with the same card / national number). */
export function saveStudent(input: StudentInput): number {
  const i = cleanInput(input)
  const db = conn()
  const noHash = hashOf(i.studentNo)
  const idH = hashOf(i.idNumber)
  const clash = noHash ? (db.prepare('SELECT id FROM students WHERE student_no_hash = ?').get(noHash) as { id: number } | undefined) : undefined
  if (clash && clash.id !== i.id) throw new Error('error.studentNoTaken')
  const cols = [noHash, noHash ? encrypt(normalizeId(i.studentNo)) : null, idH, idH ? encrypt(normalizeId(i.idNumber)) : null, i.fullName, i.fullNameAlt,
    normName(`${i.fullName} ${i.fullNameAlt}`), i.birthDate ? encrypt(i.birthDate) : null, i.phone ? encrypt(i.phone) : null, i.level, i.department, i.notes,
    i.active === false ? 0 : 1, now()] as const
  if (i.id) {
    if (!db.prepare('SELECT id FROM students WHERE id = ?').get(i.id)) throw new Error('error.notFound')
    db.prepare(`UPDATE students SET student_no_hash = ?, student_no_enc = ?, id_hash = ?, id_number_enc = ?, full_name = ?, full_name_alt = ?, name_norm = ?,
      birth_date_enc = ?, phone_enc = ?, level = ?, department = ?, notes = ?, active = ?, updated_at = ? WHERE id = ?`).run(...cols, i.id)
    return i.id
  }
  return Number(db.prepare(`INSERT INTO students (student_no_hash, student_no_enc, id_hash, id_number_enc, full_name, full_name_alt, name_norm, birth_date_enc,
    phone_enc, level, department, notes, active, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...cols, now()).lastInsertRowid)
}

export function setStudentActive(id: number, active: boolean): void {
  conn().prepare('UPDATE students SET active = ?, updated_at = ? WHERE id = ?').run(active ? 1 : 0, now(), id)
}

export function removeStudent(id: number): void {
  conn().prepare('DELETE FROM students WHERE id = ?').run(id)
}

// ---------- Excel / CSV ----------
/** the columns of the file, with the headers people use for them (Arabic, French, English), compared without accents or spaces */
const HEADERS: Record<string, string[]> = {
  studentNo: ['رقم التسجيل', 'رقم الطالب', 'رقم بطاقة الطالب', 'رقم بطاقه الطالب', 'matricule', 'n etudiant', 'numero etudiant', 'student no', 'student number', 'student id', 'studentno', 'card number', 'n de carte', 'رقم البطاقة'],
  idNumber: ['رقم التعريف الوطني', 'رقم التعريف', 'nin', 'cni', 'national id', 'id number', 'idnumber', 'national number', 'n national'],
  fullName: ['full name', 'name', 'nom et prenom', 'nom prenom', 'fullname', 'nom complet', 'name latin', 'nom latin', 'الاسم لاتيني'],
  surname: ['nom', 'surname', 'last name', 'lastname', 'family name'],
  given: ['prenom', 'prenoms', 'given name', 'given names', 'first name', 'firstname'],
  fullNameAlt: ['الاسم واللقب', 'اللقب والاسم', 'الاسم الكامل', 'الاسم و اللقب', 'اللقب و الاسم', 'name arabic', 'nom arabe', 'الاسم عربي'],
  surnameAr: ['اللقب'],
  givenAr: ['الاسم'],
  birthDate: ['تاريخ الميلاد', 'date de naissance', 'birth date', 'birthdate', 'date of birth', 'dob'],
  phone: ['الهاتف', 'رقم الهاتف', 'telephone', 'tel', 'phone', 'mobile'],
  level: ['المستوى', 'السنة', 'niveau', 'annee', 'level', 'year'],
  department: ['التخصص', 'الشعبة', 'القسم', 'specialite', 'filiere', 'departement', 'department', 'speciality', 'major']
}
const headerKey = (h: string): string => normName(h).replace(/ /g, '')

function columnsOf(headerRow: string[]): Record<string, number> {
  const found: Record<string, number> = {}
  const wanted = Object.entries(HEADERS).map(([k, list]) => [k, list.map(headerKey)] as const)
  headerRow.forEach((h, i) => {
    const hk = headerKey(h)
    if (!hk) return
    for (const [k, list] of wanted) if (found[k] === undefined && list.includes(hk)) found[k] = i
  })
  return found
}

const cellText = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    const o = v as { text?: unknown; result?: unknown; richText?: { text: string }[] }
    if (o.richText) return o.richText.map((r) => r.text).join('')
    return String(o.text ?? o.result ?? '')
  }
  return String(v)
}

/** dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy or yyyy-mm-dd → yyyy-mm-dd, else '' */
function dateOf(s: string): string {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/) ?? s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  const [d, mo, y] = m[0].match(/^\d{4}/) ? [m[3], m[2], m[1]] : [m[1], m[2], m[3]]
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export async function importStudentsFile(path: string): Promise<StudentImportResult> {
  const wb = new ExcelJS.Workbook()
  if (path.toLowerCase().endsWith('.csv')) await wb.csv.readFile(path)
  else await wb.xlsx.readFile(path)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('error.importEmpty')
  const rows: string[][] = []
  ws.eachRow({ includeEmpty: false }, (row) => rows.push((row.values as ExcelJS.CellValue[]).slice(1).map(cellText)))
  // the header is the first row that names at least a card number or a name
  const headAt = rows.findIndex((r) => { const c = columnsOf(r); return c.studentNo !== undefined || c.fullName !== undefined || c.surname !== undefined || c.fullNameAlt !== undefined || c.surnameAr !== undefined })
  if (headAt < 0) throw new Error('error.importColumns')
  const col = columnsOf(rows[headAt])
  const get = (r: string[], k: string): string => (col[k] === undefined ? '' : clean(r[col[k]]))
  const res: StudentImportResult = { added: 0, updated: 0, skipped: 0, file: path }
  const db = conn()
  db.exec('BEGIN')
  try {
    for (const r of rows.slice(headAt + 1)) {
      const latin = get(r, 'fullName') || [get(r, 'given'), get(r, 'surname')].filter(Boolean).join(' ')
      const arabic = get(r, 'fullNameAlt') || [get(r, 'givenAr'), get(r, 'surnameAr')].filter(Boolean).join(' ')
      const input: StudentInput = {
        studentNo: get(r, 'studentNo'), idNumber: get(r, 'idNumber'), fullName: latin, fullNameAlt: arabic, birthDate: dateOf(get(r, 'birthDate')),
        phone: get(r, 'phone'), level: get(r, 'level'), department: get(r, 'department'), notes: ''
      }
      if (!latin && !arabic) { res.skipped++; continue }
      // the same card number (or, without one, national number) is the same student: update it
      const h = hashOf(input.studentNo) ?? hashOf(input.idNumber)
      const col2 = hashOf(input.studentNo) ? 'student_no_hash' : 'id_hash'
      const existing = h ? (db.prepare(`SELECT id FROM students WHERE ${col2} = ?`).get(h) as { id: number } | undefined) : undefined
      try {
        saveStudent({ ...input, id: existing?.id })
        if (existing) res.updated++
        else res.added++
      } catch {
        res.skipped++
      }
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return res
}

/** An empty Excel file with the columns the import understands, and one example line. */
export async function saveTemplate(parent: BrowserWindow | null, lang: Lang): Promise<string | null> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('students', { views: [{ rightToLeft: lang === 'ar' }] })
  ws.addRow(TEMPLATE_HEADERS[lang])
  ws.addRow(lang === 'ar'
    ? ['20230001', 'بن يوسف', 'خديجة', 'Benyoucef', 'Khadidja', '', '2003-06-14', 'L2', 'حقوق', '']
    : ['20230001', 'Benyoucef', 'Khadidja', 'بن يوسف', 'خديجة', '', '2003-06-14', 'L2', 'Law', ''])
  ws.getRow(1).font = { bold: true }
  ws.columns.forEach((c) => { c.width = 18 })
  const path = await askSavePath(parent, 'students_template.xlsx', 'xlsx')
  if (!path) return null
  await wb.xlsx.writeFile(path)
  return path
}

/** The column titles of the import file, in the language asked */
export const TEMPLATE_HEADERS: Record<'ar' | 'fr' | 'en', string[]> = {
  ar: ['رقم التسجيل', 'اللقب', 'الاسم', 'Nom', 'Prénom', 'رقم التعريف الوطني', 'تاريخ الميلاد', 'المستوى', 'التخصص', 'الهاتف'],
  fr: ['Matricule', 'Nom', 'Prénom', 'اللقب', 'الاسم', 'NIN', 'Date de naissance', 'Niveau', 'Spécialité', 'Téléphone'],
  en: ['Student number', 'Surname', 'Given name', 'اللقب', 'الاسم', 'NIN', 'Date of birth', 'Level', 'Department', 'Phone']
}
