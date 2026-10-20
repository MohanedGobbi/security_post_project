// Reads every .jpg of a folder with the same Tesseract models the program uses (Arabic, French, English), offline.
// Usage: node ocr_tesseract.mjs <folder> <output.json>      (run from the repository: needs node_modules)
// Output: { "<picture name>": { "texts": { "ara+fra+eng": "<text>" }, "sec": <seconds> } }
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const { createWorker, OEM } = createRequire(join(root, 'package.json'))('tesseract.js')
const [folder, out] = process.argv.slice(2)

const worker = await createWorker(['ara', 'fra', 'eng'], OEM.LSTM_ONLY, { langPath: join(root, 'resources', 'tessdata'), cacheMethod: 'none' })
const result = {}
for (const f of readdirSync(folder).filter((n) => n.endsWith('.jpg')).sort()) {
  const t0 = Date.now()
  const { data } = await worker.recognize(readFileSync(join(folder, f)))
  result[f.replace(/\.jpg$/, '')] = { texts: { 'ara+fra+eng': data.text }, sec: (Date.now() - t0) / 1000 }
}
await worker.terminate()
writeFileSync(out, JSON.stringify(result, null, 1), 'utf8')
console.log(Object.keys(result).length, 'pictures')
