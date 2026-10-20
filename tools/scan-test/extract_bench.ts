// Runs the front-of-card field extraction (src/main/front.ts) on stored OCR output and compares each field, strictly, with what the
// synthetic card says. Usage: node extract_bench.ts <fronts folder with expect.json> <windows.json from ocr_windows.ps1>
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractFront, windowsLines } from '../../src/main/front.ts'

const [folder, file] = process.argv.slice(2)
const expect = JSON.parse(readFileSync(join(folder, 'expect.json'), 'utf8')) as Record<string, Record<string, string>>
const data = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')) as Record<string, { texts: Record<string, string> }>

const titleCase = (s: string): string => s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase())
const arNorm = (s: string): string => s.replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim()
const checks: Record<string, (e: Record<string, string>, f: Record<string, string | undefined>) => boolean> = {
  'national number': (e, f) => f.idNumber === e.nin,
  'birth date': (e, f) => f.birthDate === e.birth,
  'Latin name (given surname)': (e, f) => f.fullName === titleCase(`${e.latGiven} ${e.latSurname}`),
  'Arabic name (given surname)': (e, f) => arNorm(f.fullNameAlt ?? '') === arNorm(`${e.arGiven} ${e.arSurname}`),
  'nationality DZA': (_e, f) => f.nationality === 'DZA',
  'type national_id': (_e, f) => f.idType === 'national_id'
}
const CONDITIONS = ['flat', 'small', 'tilted', 'glare']
const names = Object.keys(expect).filter((n) => data[n])
console.log('field'.padEnd(30) + CONDITIONS.map((c) => c.padStart(8)).join('') + '   all')
const misses: string[] = []
for (const [label, ok] of Object.entries(checks)) {
  let tot = 0, n = 0
  const cells = CONDITIONS.map((c) => {
    const group = names.filter((k) => k.endsWith('_' + c))
    const hit = group.filter((k) => {
      const f = extractFront(windowsLines(data[k].texts)) as Record<string, string | undefined>
      const good = ok(expect[k], f)
      if (!good && label.startsWith('Arabic')) misses.push(`${k}: wanted "${expect[k].arGiven} ${expect[k].arSurname}" got "${f.fullNameAlt ?? ''}"`)
      return good
    }).length
    tot += hit
    n += group.length
    return `${hit}/${group.length}`.padStart(8)
  })
  console.log(label.padEnd(30) + cells.join('') + `   ${Math.floor((100 * tot) / n)}%`)
}
if (process.env.SHOW_MISSES) console.log('\n' + misses.join('\n'))
