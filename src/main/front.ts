import type { IdType, PersonFields } from '@shared/types'

/**
 * Fields of a card from the printed text of its FRONT (cards without a machine-readable zone, or one that could not be read).
 * Pure functions: the text comes from an OCR engine (src/main/winocr.ts or Tesseract), nothing here touches the machine.
 * The card layout is not known exactly, so it works on labels (Nom, Prénom, Date de naissance, اللقب, الاسم, …) followed by
 * their value on the same line or the next ones, and on the shape of the values (an 18-digit national number, a date).
 * Whatever it returns is a suggestion: the guard checks every field.
 */

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'
const toAsciiDigits = (s: string): string => s.replace(/[٠-٩۰-۹]/g, (c) => String(ARABIC_INDIC.indexOf(c) % 10))
/** Latin text without accents, upper case: REPUBLIQUE for République */
const plain = (s: string): string => toAsciiDigits(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
/** Arabic text without diacritics and with the letter variants OCR engines mix up unified */
const arNorm = (s: string): string =>
  s.replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')

const arabicCount = (s: string): number => (s.match(/[ء-ي]/g) ?? []).length
const latinCount = (s: string): number => (s.match(/[A-Za-z]/g) ?? []).length
export const isArabicLine = (s: string): boolean => arabicCount(s) > latinCount(s)

/**
 * The lines of one Windows OCR result. Windows returns the words of an Arabic line from left to right, the opposite of how
 * it is read, so they are put back in reading order. The Arabic recognizer also reads the Latin lines; the English one
 * only adds noise on Arabic text, so it is used only when no Arabic recognizer is installed.
 */
export function windowsLines(texts: Record<string, string>): string[] {
  const tags = Object.keys(texts)
  const tag = tags.find((t) => t.toLowerCase().startsWith('ar')) ?? tags[0]
  const text = tag ? texts[tag] : ''
  return text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
    .map((l) => (isArabicLine(l) ? l.split(' ').reverse().join(' ') : l))
}

// ---------- labels ----------
type Field = 'surname' | 'given' | 'birth' | 'place' | 'nin' | 'sex'

/** Which field a line names, and what is left of the line after the label ('' when the label stands alone). */
function labelOf(line: string): { field: Field; rest: string } | null {
  const p = plain(line)
  const lat = (re: RegExp, field: Field): { field: Field; rest: string } | null => {
    const m = p.match(re)
    return m ? { field, rest: line.slice(m[0].length).replace(/^[\s:.\-/|]+/, '').trim() } : null
  }
  // a Latin label is the start of the line; the father's / mother's name labels are not the person's
  if (/^(NOM|PRENOMS?|SURNAME|GIVEN|FIRST)\b.*\b(DU PERE|DE LA MERE|PERE|MERE|FATHER|MOTHER)\b/.test(p)) return null
  return lat(/^(NOM|SURNAME|LAST NAME)\b[\s:.\-/|]*/, 'surname') ?? lat(/^(PRENOMS?|GIVEN NAMES?|FIRST NAMES?)\b[\s:.\-/|]*/, 'given')
    ?? lat(/^(DATE DE NAISSANCE|DATE OF BIRTH|DATE NAISS\w*)\b[\s:.\-/|]*/, 'birth')
    ?? lat(/^(LIEU DE NAISSANCE|PLACE OF BIRTH)\b[\s:.\-/|]*/, 'place')
    ?? lat(/^(N\.?\s?I\.?\s?N\.?|NIN)\b[\s:.\-/|]*/, 'nin') ?? lat(/^(SEXE|SEX)\b[\s:.\-/|]*/, 'sex')
    ?? arabicLabel(line)
}

/** one letter more, less or different: OCR engines misread a letter of a label now and then (اللقب → اللفب, الاسم → لاسم) */
function near(word: string, target: string): boolean {
  if (word === target) return true
  if (word.length < 4 || Math.abs(word.length - target.length) > 1) return false
  const row = Array.from({ length: target.length + 1 }, (_, j) => j)
  for (let i = 1; i <= word.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= target.length; j++) {
      const keep = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (word[i - 1] === target[j - 1] ? 0 : 1))
      prev = keep
    }
  }
  return row[target.length] <= 1
}

function arabicLabel(line: string): { field: Field; rest: string } | null {
  const a = arNorm(line)
  const words = a.split(/\s+/)
  const has = (w: string): boolean => words.some((x) => near(x, w))
  const labelOnly = (n: number): boolean => words.length <= n + 1
  if (has('تاريخ') && has('الميلاد') && labelOnly(2)) return { field: 'birth', rest: '' }
  if (has('مكان') && has('الميلاد') && labelOnly(2)) return { field: 'place', rest: '' }
  if (has('رقم') && has('التعريف')) return { field: 'nin', rest: '' }
  if (near(words[0], 'اللقب') && labelOnly(1)) return { field: 'surname', rest: words.slice(1).join(' ') }
  if (near(words[0], 'الاسم') && labelOnly(1)) return { field: 'given', rest: words.slice(1).join(' ') }
  if (near(words[0], 'الجنس') && labelOnly(1)) return { field: 'sex', rest: words.slice(1).join(' ') }
  return null
}

/** words of the printed headings and labels of a card: a line holding one of them is not a name */
const HEADING_WORDS = ['CARTE', 'NATIONALE', 'IDENTITE', 'REPUBLIQUE', 'ALGERIENNE', 'DEMOCRATIQUE', 'POPULAIRE', 'NAISSANCE', 'DELIVRANCE', 'EXPIRATION', 'ADRESSE', 'PRENOM', 'SANGUIN', 'PASSEPORT', 'PASSPORT', 'PERMIS', 'CONDUIRE']
/** A Latin line that can be a person's name: letters only, one to four words, no heading word, no label. */
function isNameLine(line: string): boolean {
  if (/[^A-Za-zÀ-ɏ '’\-.]/.test(line)) return false
  const p = plain(line).replace(/[^A-Z ]/g, '')
  const words = p.split(/\s+/).filter(Boolean)
  if (words.length < 1 || words.length > 4 || p.replace(/ /g, '').length < 3) return false
  if (HEADING_WORDS.some((h) => p.replace(/ /g, '').includes(h))) return false
  return !labelOf(line) && !/^(NOM|DATE|LIEU|SEXE|SEX|NIN|N I N)\b/.test(p)
}

const nameValue = (s: string): string => s.replace(/[^A-Za-zÀ-ɏء-ي '’\-]/g, ' ').replace(/\s+/g, ' ').trim()
const titleCase = (s: string): string => s.toLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (m) => m.toUpperCase())

function validDate(d: number, m: number, y: number): string {
  const now = new Date().getFullYear()
  if (y < 1900 || y > now || m < 1 || m > 12 || d < 1 || d > 31) return ''
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const t = new Date(iso)
  return Number.isNaN(t.getTime()) || t.getUTCDate() !== d ? '' : iso
}

/** dd.mm.yyyy (also / - and spaces) → yyyy-mm-dd; '' when there is no valid date */
export function findDates(text: string): string[] {
  const out: string[] = []
  for (const m of toAsciiDigits(text).matchAll(/(\d{1,2})\s*[./\-]\s*(\d{1,2})\s*[./\-]\s*(\d{4})/g)) {
    const iso = validDate(Number(m[1]), Number(m[2]), Number(m[3]))
    if (iso) out.push(iso)
  }
  return out
}

/**
 * Enough to use as it is, without trying the machine-readable zone: a name and either the 18-digit national number or a birth
 * date, on a page that shows no MRZ and no passport heading (a passport's printed name is worth less than its verified MRZ).
 */
export function frontComplete(fields: Partial<PersonFields>, lines: string[]): boolean {
  const text = plain(lines.join('\n'))
  if (/<<|PASSPORT|PASSEPORT/.test(text)) return false
  return !!fields.fullName && (/^\d{18}$/.test(fields.idNumber ?? '') || !!fields.birthDate)
}

/** Fields found in the text of a card front; empty fields are left out. */
export function extractFront(lines: string[]): Partial<PersonFields> {
  const text = lines.join('\n')
  const got: Partial<Record<Field, string>> = {}
  const latin: Partial<Record<'surname' | 'given', string>> = {}
  const arab: Partial<Record<'surname' | 'given', string>> = {}
  let birthText = ''
  let givenLabelAt = -1

  for (let i = 0; i < lines.length; i++) {
    const label = labelOf(lines[i])
    if (!label) continue
    if (label.field === 'given' && isArabicLine(lines[i]) && givenLabelAt < 0) givenLabelAt = i
    // the value: the rest of the label's line, then the lines after it until the next label (at most two)
    const values = [label.rest, ...lines.slice(i + 1, i + 3).filter((l, k, arr) => !arr.slice(0, k).some((x) => labelOf(x)) && !labelOf(l))].filter(Boolean)
    if (label.field === 'surname' || label.field === 'given') {
      for (const v of values) {
        // "Surname / Nom": the second label of a bilingual label is not the value
        if (/^(NOM|PRENOMS?|SURNAME|GIVEN|FIRST|NAME)\b/.test(plain(v))) continue
        const name = nameValue(v)
        if (name.replace(/[^A-Za-zÀ-ɏء-ي]/g, '').length < 2) continue
        const bucket = isArabicLine(name) ? arab : latin
        bucket[label.field] ??= name
      }
    } else if (label.field === 'birth') birthText += '\n' + values.join('\n')
    else if (label.field === 'sex') got.sex ??= values[0] ?? ''
    else if (label.field === 'nin') got.nin ??= values.join(' ')
  }

  // Latin name labels that were misread: the unlabelled name-like lines before the birth label are surname, then given names
  if (!latin.surname || !latin.given) {
    const birthAt = lines.findIndex((l) => labelOf(l)?.field === 'birth' || labelOf(l)?.field === 'place')
    const used = new Set([latin.surname, latin.given].filter(Boolean))
    const candidates = lines.slice(0, birthAt >= 0 ? birthAt : undefined).filter(isNameLine).map(nameValue).filter((n) => !used.has(n))
    if (!latin.surname && !latin.given) [latin.surname, latin.given] = [candidates[0], candidates[1]]
    else if (!latin.surname) latin.surname = candidates[0]
    else latin.given = candidates[0]
  }

  // the surname label was not read but its value stands right before the given-name label (surname comes first on the card)
  if (!arab.surname && arab.given && givenLabelAt > 0) {
    const before = lines[givenLabelAt - 1]
    if (isArabicLine(before) && !labelOf(before) && before.split(/\s+/).length <= 3 && !/^ال/.test(arNorm(before).split(/\s+/)[0] ?? '')) arab.surname = nameValue(before)
  }

  // national number: 18 digits anywhere, else the digits next to its label
  const digits = toAsciiDigits(text)
  const nin = digits.match(/(?<!\d)\d{18}(?!\d)/)?.[0] ?? (got.nin ? toAsciiDigits(got.nin).replace(/\D/g, '') : '')
  // birth date: the one after its label, else the oldest date on the card (issue and expiry dates are later)
  const dates = findDates(birthText).length ? findDates(birthText) : findDates(text).sort()
  const sexText = arNorm(got.sex ?? '')
  const sex = /^(M|H)\b/i.test(got.sex ?? '') || sexText.startsWith('ذكر') ? 'M' : /^F\b/i.test(got.sex ?? '') || sexText.startsWith('انثي') || sexText.startsWith('انثى') ? 'F' : ''

  const compose = (b: Partial<Record<'surname' | 'given', string>>): string => [b.given, b.surname].filter(Boolean).join(' ')
  const latinName = titleCase(compose(latin))
  const arabName = compose(arab)
  const P = plain(text)
  const A = arNorm(text)
  let idType: IdType | undefined
  if (/PERMIS DE CONDUIRE|DRIVING LICEN/.test(P) || A.includes('رخصه السياقه')) idType = 'driver_license'
  else if (/SEJOUR|RESIDENCE PERMIT/.test(P) || A.includes('الاقامه')) idType = 'residence'
  else if (/IDENTITE|IDENTITY CARD/.test(P) || A.includes('بطاقه التعريف') || nin) idType = 'national_id'

  const fields: Partial<PersonFields> = {
    fullName: latinName || arabName,
    fullNameAlt: latinName ? arabName : '',
    idNumber: nin,
    birthDate: dates[0] ?? '',
    sex,
    nationality: /ALGERIENNE|ALGERIAN/.test(P) || A.includes('الجزائريه') ? 'DZA' : '',
    ...(idType ? { idType } : {})
  }
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v)) as Partial<PersonFields>
}
