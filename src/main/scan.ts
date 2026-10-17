import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import { parse as parseMrz, type ParseResult } from 'mrz'
import type { IdType, PersonFields, ScanResult } from '@shared/types'

const resourcesDir = (): string => (app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources'))

let zxingReady = false
function ensureZxing(): void {
  if (zxingReady) return
  // Load the wasm from disk instead of the default CDN so scanning works offline
  const wasm = readFileSync(join(app.getAppPath(), 'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'))
  prepareZXingModule({ overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer } })
  zxingReady = true
}

let mrzWorker: Promise<Worker> | null = null
let textWorker: Promise<Worker> | null = null

// 'mrz' is a model trained on the OCR-B font used in machine-readable zones (see resources/tessdata/NOTICE.md).
// Generic models read the '<' filler as K / L / C.
function getMrzWorker(): Promise<Worker> {
  mrzWorker ??= (async () => {
    const w = await createWorker('mrz', OEM.LSTM_ONLY, {
      langPath: join(resourcesDir(), 'tessdata'),
      cacheMethod: 'none'
    }, { load_system_dawg: '0', load_freq_dawg: '0' })
    await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<', tessedit_pageseg_mode: PSM.AUTO })
    return w
  })()
  return mrzWorker
}

function getTextWorker(): Promise<Worker> {
  textWorker ??= createWorker(['ara', 'fra', 'eng'], OEM.LSTM_ONLY, {
    langPath: join(resourcesDir(), 'tessdata'),
    cacheMethod: 'none'
  })
  return textWorker
}

/** Starts loading OCR models in the background so the first scan is fast. */
export function warmUpScanner(): void {
  getMrzWorker().catch(() => (mrzWorker = null))
}

export async function shutdownScanner(): Promise<void> {
  for (const w of [mrzWorker, textWorker]) {
    if (w) await (await w).terminate().catch(() => undefined)
  }
}

// ---------- MRZ ----------
const MRZ_LAYOUTS: { lines: number; width: number }[] = [
  { lines: 3, width: 30 }, // TD1: most ID cards
  { lines: 2, width: 44 }, // TD3: passports
  { lines: 2, width: 36 } // TD2 / old French ID
]

/** Normalises OCR output into lines that look like MRZ (lots of '<' and only MRZ characters). */
export function mrzCandidateLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.toUpperCase().replace(/[«‹]/g, '<').replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 26 && (l.match(/</g)?.length ?? 0) >= 2)
}

const fit = (line: string, width: number): string => (line.length >= width ? line.slice(0, width) : line.padEnd(width, '<'))

/** Positions that can only hold digits (dates + check digits), per layout: [line, from, to] inclusive. */
const NUMERIC_SPANS: Record<number, [number, number, number][]> = {
  30: [[1, 0, 6], [1, 8, 14], [1, 29, 29]],
  44: [[1, 9, 9], [1, 13, 19], [1, 21, 27], [1, 42, 43]],
  36: [[1, 9, 9], [1, 13, 19], [1, 21, 27], [1, 35, 35]]
}
const DIGIT_FIX: Record<string, string> = { Q: '0', D: '0', U: '0', O: '0', I: '1', L: '1', Z: '2', S: '5', G: '6', T: '7', B: '8' }

/** Fixes letters OCR'd in digit-only positions (the parser's own autocorrect misses a few, e.g. Q for 0). */
function fixDigits(lines: string[], width: number): string[] {
  const out = lines.map((l) => l.split(''))
  for (const [li, from, to] of NUMERIC_SPANS[width] ?? []) {
    for (let i = from; i <= to; i++) {
      const c = out[li]?.[i]
      if (c && DIGIT_FIX[c]) out[li][i] = DIGIT_FIX[c]
    }
  }
  return repairDocumentNumber(out.map((l) => l.join('')), width)
}

/** ICAO 9303 check digit (weights 7-3-1, '<' = 0, A = 10 …). */
function checkDigit(s: string): number {
  const val = (c: string): number => (c === '<' ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55)
  return s.split('').reduce((sum, c, i) => sum + val(c) * [7, 3, 1][i % 3], 0) % 10
}

/** Document number + its check digit position, per layout: [line, start, length]. */
const DOC_NUMBER: Record<number, [number, number, number]> = { 30: [0, 5, 9], 44: [1, 0, 9], 36: [1, 0, 9] }
const SWAPS: Record<string, string> = { O: '0', '0': 'O', I: '1', '1': 'I', B: '8', '8': 'B', S: '5', '5': 'S', Z: '2', '2': 'Z', D: '0' }

/** Document numbers mix letters and digits, so O/0-style misreads are fixed only when exactly one swap satisfies the check digit. */
function repairDocumentNumber(lines: string[], width: number): string[] {
  const spec = DOC_NUMBER[width]
  if (!spec) return lines
  const [li, start, len] = spec
  const line = lines[li]
  if (!line) return lines
  const num = line.slice(start, start + len)
  const cd = line[start + len]
  if (!/\d/.test(cd) || checkDigit(num) === Number(cd)) return lines
  const candidates: { value: string; swaps: number }[] = []
  const ambiguous = [...num].map((c, i) => (SWAPS[c] ? i : -1)).filter((i) => i >= 0)
  // try every combination of swaps on the ambiguous characters (at most 2^6 variants)
  for (let mask = 1; mask < 1 << Math.min(ambiguous.length, 6); mask++) {
    const chars = num.split('')
    let swaps = 0
    ambiguous.forEach((pos, bit) => { if (mask & (1 << bit)) { chars[pos] = SWAPS[chars[pos]]; swaps++ } })
    const value = chars.join('')
    if (checkDigit(value) === Number(cd)) candidates.push({ value, swaps })
  }
  // the smallest correction wins, but only if no other correction is as small
  const fewest = Math.min(...candidates.map((c) => c.swaps))
  const best = candidates.filter((c) => c.swaps === fewest)
  if (best.length !== 1) return lines
  const fixed = [...lines]
  fixed[li] = line.slice(0, start) + best[0].value + line.slice(start + len)
  return fixed
}

/** Nationality as printed, even when the parser does not know the country code. */
function rawNationality(format: string, lines: string[]): string {
  const raw = format === 'TD1' ? lines[1]?.slice(15, 18) : format === 'TD2' || format === 'TD3' ? lines[1]?.slice(10, 13) : ''
  return (raw ?? '').replace(/</g, '')
}

/** true when every check digit matches (country codes are not required to be known) */
const checkDigitsOk = (r: ParseResult): boolean => {
  const checks = r.details.filter((d) => d.field?.endsWith('CheckDigit'))
  return checks.length > 0 && checks.every((d) => d.valid)
}

function scoreResult(r: ParseResult): number {
  const checks = r.details.filter((d) => d.field?.endsWith('CheckDigit'))
  return checks.filter((d) => d.valid).length * 3 + r.details.filter((d) => d.valid).length - (checkDigitsOk(r) ? 0 : 5)
}

export function parseMrzLines(lines: string[]): { result: ParseResult; lines: string[] } | null {
  let best: { result: ParseResult; lines: string[] } | null = null
  for (const layout of MRZ_LAYOUTS) {
    if (lines.length < layout.lines) continue
    // try every consecutive window of lines, the MRZ is usually at the bottom
    for (let start = lines.length - layout.lines; start >= 0; start--) {
      const window = lines.slice(start, start + layout.lines)
      if (window.some((l) => Math.abs(l.length - layout.width) > 4)) continue
      const fitted = fixDigits(window.map((l) => fit(l, layout.width)), layout.width)
      try {
        const result = parseMrz(fitted, { autocorrect: true })
        if (!best || scoreResult(result) > scoreResult(best.result)) best = { result, lines: fitted }
        if (checkDigitsOk(result)) return best
      } catch {
        // not a supported layout for these lines
      }
    }
  }
  return best
}

/** YYMMDD -> YYYY-MM-DD. Birth dates are always in the past. */
function mrzDate(yymmdd: string | null | undefined): string {
  if (!yymmdd || !/^\d{6}$/.test(yymmdd)) return ''
  const yy = Number(yymmdd.slice(0, 2))
  const century = yy > new Date().getFullYear() % 100 ? 1900 : 2000
  return `${century + yy}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`
}

const titleCase = (s: string): string => s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase())

/**
 * Name zone is SURNAME<<GIVEN<NAMES<<<<… : anything after the next '<<' is filler (and OCR noise).
 * Single letters stuck to the filler (a misread '<') are dropped.
 */
function nameFromMrz(r: ParseResult, lines: string[]): string | null {
  let zone: string | undefined
  if (r.format === 'TD1') zone = lines[2]
  else if (r.format === 'TD2' || r.format === 'TD3') zone = lines[0]?.slice(5)
  if (!zone) return null
  const [surname = '', given = ''] = zone.split('<<')
  const words = (s: string): string[] => s.split('<').map((w) => w.replace(/[^A-Z]/g, '')).filter((w) => w.length > 1)
  const name = [...words(given), ...words(surname)].join(' ')
  return name ? titleCase(name) : null
}

const detailValue = (r: ParseResult, field: string): string => r.details.find((d) => d.field === field)?.value ?? ''

function mrzToFields(r: ParseResult, lines: string[]): Partial<PersonFields> {
  const f = r.fields
  const code = (f.documentCode ?? '').toUpperCase()
  let idType: IdType = 'national_id'
  if (code.startsWith('P')) idType = 'passport'
  else if (r.format === 'FRENCH_DRIVING_LICENSE' || r.format === 'SWISS_DRIVING_LICENSE') idType = 'driver_license'
  else if (code.startsWith('IR') || code.startsWith('AR') || code.startsWith('RP')) idType = 'residence'
  const sex = f.sex === 'male' ? 'M' : f.sex === 'female' ? 'F' : ''
  return {
    fullName: nameFromMrz(r, lines) ?? titleCase([f.firstName, f.lastName].filter(Boolean).join(' ').trim()),
    idType,
    idNumber: (f.documentNumber ?? r.documentNumber ?? '').replace(/</g, ''),
    // unknown country codes are rejected by the parser but are still worth showing
    nationality: f.nationality || rawNationality(r.format, lines) || f.issuingState || '',
    birthDate: mrzDate(f.birthDate ?? detailValue(r, 'birthDate')),
    sex
  }
}

/** Name zone with letters inside the filler or stray single letters: probably misread '<'. */
function nameLooksNoisy(m: { result: ParseResult; lines: string[] }): boolean {
  const zone = m.result.format === 'TD1' ? m.lines[2] : m.lines[0]?.slice(5)
  if (!zone) return false
  const [, given = '', ...rest] = zone.split('<<')
  return rest.join('').replace(/</g, '') !== '' || given.split('<').some((w) => w.length === 1)
}

const quality = (m: { result: ParseResult; lines: string[] }): number => scoreResult(m.result) - (nameLooksNoisy(m) ? 2 : 0)

// ---------- barcodes ----------
/** AAMVA PDF417 on North-American driver licences */
function parseAamva(text: string): Partial<PersonFields> | null {
  if (!text.startsWith('@') || !/ANSI|AAMVA/.test(text)) return null
  const get = (k: string): string => text.match(new RegExp(`(?:^|\\n)${k}([^\\n\\r]*)`))?.[1]?.trim() ?? ''
  const dob = get('DBB')
  const birthDate = /^\d{8}$/.test(dob) ? `${dob.slice(4)}-${dob.slice(0, 2)}-${dob.slice(2, 4)}` : ''
  const sex = get('DBC') === '1' ? 'M' : get('DBC') === '2' ? 'F' : ''
  return {
    fullName: titleCase([get('DAC'), get('DAD'), get('DCS')].filter(Boolean).join(' ')),
    idType: 'driver_license',
    idNumber: get('DAQ'),
    birthDate,
    sex
  }
}

async function scanBarcodes(image: Uint8Array): Promise<{ format: string; text: string }[]> {
  ensureZxing()
  const results = await readBarcodes(image, { tryHarder: true, tryRotate: true, tryInvert: true, maxNumberOfSymbols: 4 })
  return results.filter((r) => r.isValid && r.text).map((r) => ({ format: r.format, text: r.text }))
}

// ---------- public API ----------
/** Barcode / QR texts only, fast (patrol checkpoint labels) */
export async function barcodeTexts(image: Uint8Array): Promise<string[]> {
  return (await scanBarcodes(image).catch(() => [])).map((b) => b.text)
}

export async function analyzeImage(image: Uint8Array): Promise<ScanResult> {
  const empty: ScanResult = { source: 'none', fields: {}, valid: false, rawMrz: [], barcodes: [], lines: [] }
  const barcodes = await scanBarcodes(image).catch(() => [])
  empty.barcodes = barcodes

  if (barcodes.some((b) => b.text.startsWith('SECREG-'))) return empty

  for (const b of barcodes) {
    const aamva = parseAamva(b.text)
    if (aamva) return { ...empty, source: 'barcode', fields: aamva, valid: true }
    // some cards encode their MRZ inside a 2D barcode
    const mrz = parseMrzLines(mrzCandidateLines(b.text))
    if (mrz && checkDigitsOk(mrz.result)) {
      return { ...empty, source: 'barcode', fields: mrzToFields(mrz.result, mrz.lines), valid: true, rawMrz: mrz.lines }
    }
  }

  // 1st pass: fast English-only model
  const { data } = await (await getMrzWorker()).recognize(Buffer.from(image))
  let mrz = parseMrzLines(mrzCandidateLines(data.text))
  let lines: string[] = []
  // 2nd pass: the multilingual model reads differently, and also gives the guard text lines to pick from
  if (!mrz || !checkDigitsOk(mrz.result) || nameLooksNoisy(mrz)) {
    const text = await recognizeText(image)
    lines = cleanLines(text)
    const second = parseMrzLines(mrzCandidateLines(text))
    if (second && (!mrz || quality(second) > quality(mrz))) mrz = second
  }
  if (mrz && scoreResult(mrz.result) > 0) {
    const valid = checkDigitsOk(mrz.result)
    return { ...empty, source: 'mrz', fields: mrzToFields(mrz.result, mrz.lines), valid, rawMrz: mrz.lines, lines: valid ? [] : lines }
  }
  return { ...empty, lines }
}

async function recognizeText(image: Uint8Array): Promise<string> {
  const { data } = await (await getTextWorker()).recognize(Buffer.from(image))
  return data.text
}

/** Free OCR of the card (Arabic, French, English). Returns readable lines for the guard to pick from. */
export async function readText(image: Uint8Array): Promise<string[]> {
  return cleanLines(await recognizeText(image))
}

function cleanLines(text: string): string[] {
  const seen = new Set<string>()
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/[‎‏‪-‮]/g, '').replace(/\s+/g, ' ').trim())
    .filter((l) => l.replace(/[^\p{L}\p{N}]/gu, '').length >= 2)
    .filter((l) => !seen.has(l) && (seen.add(l), true))
}
