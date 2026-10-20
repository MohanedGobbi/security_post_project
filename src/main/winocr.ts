import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { app } from 'electron'

/**
 * The OCR built into Windows (offline), used for the printed text of cards: Latin text and numbers are read much better
 * and faster than with Tesseract, Arabic about as well or better. It runs in one long-lived PowerShell helper
 * (resources/ocr/winocr.ps1) so each picture costs about 0.2 s; pictures go over stdin and never touch the disk.
 * Not available (not Windows, no PowerShell, no OCR language installed): the callers fall back to Tesseract.
 */

const TIMEOUT_MS = 20_000
const scriptPath = (): string => join(app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources'), 'ocr', 'winocr.ps1')

export interface WindowsOcrTexts {
  /** recognizer language tag (ar-SA, en-GB, …) → the lines it read, in the order Windows returned them */
  [language: string]: string
}

interface Helper {
  proc: ChildProcessWithoutNullStreams
  languages: string[]
  /** answers wait here, in the order the pictures were sent */
  waiting: ((line: string | null) => void)[]
}

let helper: Promise<Helper | null> | null = null
let chain: Promise<unknown> = Promise.resolve()

function startHelper(): Promise<Helper | null> {
  if (process.platform !== 'win32' || !existsSync(scriptPath())) return Promise.resolve(null)
  return new Promise((resolve) => {
    const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath()], { windowsHide: true })
    const h: Helper = { proc, languages: [], waiting: [] }
    let ready = false
    const fail = (): void => {
      helper = null
      if (!ready) resolve(null)
      for (const w of h.waiting.splice(0)) w(null)
    }
    proc.on('error', fail)
    proc.on('exit', fail)
    proc.stderr.resume()
    createInterface({ input: proc.stdout, crlfDelay: Infinity }).on('line', (line) => {
      if (!ready) {
        try {
          h.languages = (JSON.parse(line) as { languages?: string[] }).languages ?? []
        } catch {
          return
        }
        ready = true
        resolve(h.languages.length ? h : null)
        return
      }
      h.waiting.shift()?.(line)
    })
    setTimeout(() => { if (!ready) { proc.kill(); fail() } }, TIMEOUT_MS)
  })
}

/** The recognizer languages of this PC (empty when the Windows OCR cannot be used). */
export async function windowsOcrLanguages(): Promise<string[]> {
  helper ??= startHelper()
  return (await helper)?.languages ?? []
}

/** Reads one picture. Returns null when the Windows OCR is not available or failed (use another engine). */
export function windowsOcr(image: Uint8Array): Promise<WindowsOcrTexts | null> {
  const run = async (): Promise<WindowsOcrTexts | null> => {
    helper ??= startHelper()
    const h = await helper
    if (!h) return null
    const answer = new Promise<string | null>((resolve) => {
      h.waiting.push(resolve)
      setTimeout(() => { if (h.waiting.includes(resolve)) { h.proc.kill() } }, TIMEOUT_MS)
    })
    h.proc.stdin.write(Buffer.from(image).toString('base64') + '\n')
    const line = await answer
    if (!line) return null
    try {
      const r = JSON.parse(line) as { ok: boolean; texts?: WindowsOcrTexts }
      return r.ok && r.texts ? r.texts : null
    } catch {
      return null
    }
  }
  // one picture at a time: the helper answers in order
  const result = chain.then(run, run)
  chain = result.catch(() => undefined)
  return result
}

export function shutdownWindowsOcr(): void {
  helper?.then((h) => h?.proc.kill()).catch(() => undefined)
  helper = null
}
