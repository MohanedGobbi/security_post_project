// Minimal HTTP toolkit on node:http: routing, JSON bodies, cookies, static files, security headers.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface Req {
  raw: IncomingMessage
  method: string
  path: string
  query: URLSearchParams
  params: Record<string, string>
  cookies: Record<string, string>
  body: unknown
  ip: string
}

type Handler = (req: Req, res: ServerResponse) => unknown | Promise<unknown>

interface Route { method: string; parts: string[]; handler: Handler }

const routes: Route[] = []

export function route(method: string, pattern: string, handler: Handler): void {
  routes.push({ method, parts: pattern.split('/').filter(Boolean), handler })
}

function match(r: Route, method: string, parts: string[]): Record<string, string> | null {
  if (r.method !== method || r.parts.length !== parts.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < parts.length; i++) {
    if (r.parts[i].startsWith(':')) params[r.parts[i].slice(1)] = decodeURIComponent(parts[i])
    else if (r.parts[i] !== parts[i]) return null
  }
  return params
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

const MAX_BODY = 10 * 1024 * 1024

async function readJson(req: IncomingMessage): Promise<unknown> {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method ?? '')) return undefined
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY) throw new HttpError(413, 'too_large')
    chunks.push(chunk as Buffer)
  }
  if (size === 0) return {}
  if (!(req.headers['content-type'] ?? '').includes('application/json')) throw new HttpError(415, 'json_required')
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'bad_json')
  }
}

export function sendJson(res: ServerResponse, status: number, data: unknown, headers: Record<string, string | string[]> = {}): void {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end(body)
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json'
}

/** Serves the built dashboard; unknown paths fall back to index.html (single-page app). */
function serveStatic(root: string, path: string, res: ServerResponse): void {
  const safe = normalize(decodeURIComponent(path)).replace(/^([/\\])+/, '')
  let file = join(root, safe)
  if (!file.startsWith(root + sep) && file !== root) throw new HttpError(403, 'forbidden')
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html')
  if (!existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Dashboard not built. Run: npm run build:dashboard')
    return
  }
  const ext = extname(file)
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...SECURITY_HEADERS
  })
  createReadStream(file).pipe(res)
}

export function makeHandler(staticRoot: string) {
  return async (raw: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(raw.url ?? '/', 'http://localhost')
    const method = raw.method ?? 'GET'
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v)
    try {
      if (!url.pathname.startsWith('/api/')) {
        if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'method')
        return serveStatic(staticRoot, url.pathname, res)
      }
      const parts = url.pathname.split('/').filter(Boolean)
      for (const r of routes) {
        const params = match(r, method, parts)
        if (!params) continue
        const req: Req = {
          raw, method, path: url.pathname, query: url.searchParams, params,
          cookies: parseCookies(raw.headers.cookie), body: await readJson(raw), ip: raw.socket.remoteAddress ?? ''
        }
        const out = await r.handler(req, res)
        if (!res.headersSent) sendJson(res, 200, out ?? { ok: true })
        return
      }
      throw new HttpError(404, 'not_found')
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500
      if (status === 500) console.error(new Date().toISOString(), method, url.pathname, e)
      if (!res.headersSent) sendJson(res, status, { error: e instanceof HttpError ? e.message : 'server_error' })
    }
  }
}

// ---------- small validation helpers ----------
export const str = (v: unknown, max = 500): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
export const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
export const bool = (v: unknown): boolean => v === true || v === 'true' || v === 1
export const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
