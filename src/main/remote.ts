import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { createServer, type Server } from 'node:https'
import { isIP } from 'node:net'
import { networkInterfaces } from 'node:os'
import { extname, join, normalize, sep } from 'node:path'
import { promisify } from 'node:util'
import { app } from 'electron'
import type { RemoteSettings, RemoteStatus, User } from '@shared/types'
import { audit, conn } from './db'
import type { RemoteContext, Session } from './context'

/**
 * The deanship's access over the faculty network. The program stays on the security office PC with its data; when the
 * administrator switches this on, the PC also serves the same screens, over HTTPS, to the browsers of the addresses on its
 * list, and only the dean's account (level "dean") can sign in there. It is off until an administrator turns it on.
 *
 * What the dean can call is the list below: reading registers, visits and attendance, printing, and the deanship's visa.
 * Everything else (recording visitors, accounts, settings, backups…) is refused for a network session.
 */
const ALLOWED = new Set([
  'auth:status', 'auth:loginPin', 'auth:logout', 'auth:setLanguage', 'auth:loginUsers',
  'visits:insideNow', 'visits:search', 'visits:get', 'visits:stats',
  'registers:list', 'registers:entries', 'registers:close', 'registers:corrections', 'registers:accounts',
  'incidents:open', 'incidents:search', 'incidents:get', 'incidents:close',
  'shifts:list', 'alerts:list', 'settings:get', 'settings:getFeatures', 'equipment:list',
  'exports:pdf', 'exports:excel', 'exports:registerPdf', 'exports:entryPdf', 'exports:registerXlsx', 'exports:entryXlsx',
  'exports:visitPdf', 'exports:visitXlsx', 'exports:shiftReport',
  'attendance:staff', 'attendance:day', 'attendance:month', 'attendance:dayPdf', 'attendance:monthPdf'
])

const IDLE_MS = 30 * 60_000
const MAX_BODY = 1_000_000
const DEFAULT_PORT = 8443

type Dispatch = (channel: string, args: unknown[], ctx: RemoteContext) => Promise<unknown>
let dispatch: Dispatch | null = null
let server: Server | null = null
let lastError = ''
const sessions = new Map<string, { session: Session; last: number }>()

// ---------- the settings (kept in the settings table, off by default) ----------
function readSetting(key: string, fallback: string): string {
  const row = conn().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row ? row.value : fallback
}
const writeSetting = (key: string, value: string): void => { conn().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value) }

function readSettings(): RemoteSettings {
  return {
    enabled: readSetting('remoteEnabled', '0') === '1',
    port: Number(readSetting('remotePort', String(DEFAULT_PORT))) || DEFAULT_PORT,
    allowedIps: readSetting('remoteIps', '').split(',').map((s) => s.trim()).filter(Boolean)
  }
}

/** the addresses of this PC on the faculty network, to tell the dean where to go */
function localAddresses(): string[] {
  return Object.values(networkInterfaces()).flat().filter((i): i is NonNullable<typeof i> => !!i && i.family === 'IPv4' && !i.internal).map((i) => i.address)
}

export function remoteStatus(): RemoteStatus {
  const s = readSettings()
  const running = !!server?.listening
  return { ...s, running, urls: running ? localAddresses().map((ip) => `https://${ip}:${s.port}`) : [], error: lastError }
}

export function setRemote(input: RemoteSettings, user: User): RemoteStatus {
  const port = Math.round(Number(input?.port))
  if (!(port >= 1024 && port <= 65535)) throw new Error('error.remotePort')
  const ips = [...new Set((input?.allowedIps ?? []).map((s) => String(s).trim()).filter(Boolean))]
  if (ips.some((ip) => !isIP(ip)) || ips.length > 10) throw new Error('error.remoteIp')
  if (input?.enabled && ips.length === 0) throw new Error('error.remoteNeedsIp')
  writeSetting('remoteEnabled', input?.enabled ? '1' : '0')
  writeSetting('remotePort', String(port))
  writeSetting('remoteIps', ips.join(','))
  audit(user.id, 'remote_settings', '', null, `${input?.enabled ? 'on' : 'off'} · port ${port} · ${ips.join(' ')}`)
  void restart()
  return { ...readSettings(), running: false, urls: [], error: '' }
}

// ---------- the certificate: made once, by openssl, for the addresses of this PC ----------
const run = promisify(execFile)

async function certificate(): Promise<{ key: Buffer; cert: Buffer }> {
  const dir = join(app.getPath('userData'), 'remote')
  mkdirSync(dir, { recursive: true })
  const keyFile = join(dir, 'key.pem')
  const certFile = join(dir, 'cert.pem')
  const stampFile = join(dir, 'addresses.txt')
  const addresses = ['127.0.0.1', ...localAddresses()].sort().join(',')
  if (!(existsSync(keyFile) && existsSync(certFile) && existsSync(stampFile) && readFileSync(stampFile, 'utf8') === addresses)) {
    const san = ['DNS:localhost', ...addresses.split(',').map((ip) => `IP:${ip}`)].join(',')
    await run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile, '-days', '3650',
      '-subj', '/CN=Faculty Security Management/O=ROWD Tech', '-addext', `subjectAltName=${san}`], { timeout: 30_000 })
    writeFileSync(stampFile, addresses)
  }
  return { key: readFileSync(keyFile), cert: readFileSync(certFile) }
}

// ---------- the server ----------
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json'
}
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
}
const rendererDir = (): string => join(__dirname, '../renderer')

const clientIp = (raw: string | undefined): string => (raw ?? '').replace(/^::ffff:/, '')

function sessionOf(cookie: string | undefined): { id: string; fresh: boolean; entry: { session: Session; last: number } } {
  const sid = /(?:^|;\s*)sid=([a-f0-9]{48})/.exec(cookie ?? '')?.[1]
  const found = sid ? sessions.get(sid) : undefined
  if (sid && found && Date.now() - found.last < IDLE_MS) {
    found.last = Date.now()
    return { id: sid, fresh: false, entry: found }
  }
  const id = randomBytes(24).toString('hex')
  const entry = { session: { user: null } as Session, last: Date.now() }
  sessions.set(id, entry)
  return { id, fresh: true, entry }
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const parts: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) { reject(new Error('too big')); req.destroy(); return }
      parts.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')))
    req.on('error', reject)
  })
}

async function start(): Promise<void> {
  if (server || !dispatch) return
  const s = readSettings()
  if (!s.enabled) return
  lastError = ''
  const call = dispatch
  try {
    const tls = await certificate()
    const srv = createServer(tls, async (req, res) => {
      const ip = clientIp(req.socket.remoteAddress)
      // only the addresses on the administrator's list (read again at every request, so a change takes effect at once)
      if (!readSettings().allowedIps.includes(ip)) { res.writeHead(403, { 'Content-Type': 'text/plain' }); res.end('Forbidden'); return }
      try {
        const url = new URL(req.url ?? '/', 'https://x')
        if (req.method === 'POST' && url.pathname === '/rpc') return await handleRpc(req, res, ip, call)
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return }
        await serveStatic(url.pathname, res)
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Error')
        console.error('[remote]', e)
      }
    })
    srv.requestTimeout = 120_000
    await new Promise<void>((resolve, reject) => { srv.once('error', reject); srv.listen(s.port, '0.0.0.0', () => resolve()) })
    server = srv
  } catch (e) {
    lastError = e instanceof Error ? (/openssl/i.test(e.message) ? 'openssl is not installed' : e.message) : String(e)
    server = null
  }
}

async function serveStatic(pathname: string, res: import('node:http').ServerResponse): Promise<void> {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '')
  const full = normalize(join(rendererDir(), rel))
  if (!full.startsWith(rendererDir() + sep)) { res.writeHead(403); res.end(); return }
  try {
    const data = await readFile(full)
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': MIME[extname(full)] ?? 'application/octet-stream', 'Cache-Control': rel === 'index.html' ? 'no-store' : 'public, max-age=3600' })
    res.end(data)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  }
}

async function handleRpc(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, ip: string, call: Dispatch): Promise<void> {
  const json = (code: number, body: unknown, extra: Record<string, string> = {}): void => {
    res.writeHead(code, { ...SECURITY_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra })
    res.end(JSON.stringify(body))
  }
  // same-origin only: a page from another site cannot make the dean's browser call this
  const origin = req.headers['origin']
  if ((origin && origin !== `https://${req.headers['host']}`) || !String(req.headers['content-type'] ?? '').startsWith('application/json')) return json(403, { ok: false, error: 'error.forbidden' })
  let body: { channel?: unknown; args?: unknown }
  try { body = JSON.parse(await readBody(req)) } catch { return json(400, { ok: false, error: 'error.invalid' }) }
  const channel = String(body.channel ?? '')
  if (!ALLOWED.has(channel) || !Array.isArray(body.args)) return json(403, { ok: false, error: 'error.forbidden' })

  const { id, fresh, entry } = sessionOf(req.headers['cookie'])
  const ctx: RemoteContext = { session: entry.session, ip, files: [] }
  const cookie: Record<string, string> = fresh ? { 'Set-Cookie': `sid=${id}; Path=/; HttpOnly; Secure; SameSite=Strict` } : {}
  try {
    const result = await call(channel, body.args, ctx)
    if (channel === 'auth:logout') sessions.delete(id)
    const files = await Promise.all(ctx.files.map(async (f) => ({ name: f.name, data: (await readFile(f.path)).toString('base64') })))
    json(200, { ok: true, result: result ?? null, files }, cookie)
  } catch (e) {
    json(200, { ok: false, error: e instanceof Error ? e.message : String(e) }, cookie)
  } finally {
    await Promise.all(ctx.files.map((f) => rm(f.path, { force: true })))
  }
}

async function stop(): Promise<void> {
  const s = server
  server = null
  sessions.clear()
  if (s) await new Promise<void>((resolve) => { s.close(() => resolve()); s.closeAllConnections?.() })
}

async function restart(): Promise<void> {
  await stop()
  await start()
}

/** Called once every handler is registered: remembers how to call them, and starts the server if it was left on. */
export function initRemote(d: Dispatch): void {
  dispatch = d
  setInterval(() => { for (const [id, e] of sessions) if (Date.now() - e.last > IDLE_MS) sessions.delete(id) }, 60_000).unref()
  void start()
  app.once('before-quit', () => { void stop() })
}
