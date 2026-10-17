import type { ServerResponse } from 'node:http'
import { conn, now } from './db.ts'
import { newToken, sha256, verifyPassword } from './crypto.ts'
import { HttpError, type Req } from './http.ts'

export type Role = 'owner' | 'supervisor' | 'host'

export interface SessionUser {
  id: number
  email: string
  name: string
  role: Role
  language: string
  /** sites this user may see; null = all (owner) */
  siteIds: number[] | null
}

const SESSION_DAYS = 7
const COOKIE = 'sid'
let secureCookies = false
export const useSecureCookies = (on: boolean): void => { secureCookies = on }

// ---------- login throttling: 5 failures per email lock it for one minute ----------
const failures = new Map<string, { count: number; until: number }>()

export function login(email: string, password: string): SessionUser & { token: string } {
  const key = email.toLowerCase()
  const f = failures.get(key)
  if (f && f.until > Date.now()) throw new HttpError(429, 'locked')
  const row = conn().prepare('SELECT id, pass_hash, active FROM users WHERE email = ?').get(email) as
    { id: number; pass_hash: string; active: number } | undefined
  if (!row || row.active !== 1 || !verifyPassword(password, row.pass_hash)) {
    const count = (f?.count ?? 0) + 1
    failures.set(key, { count: count >= 5 ? 0 : count, until: count >= 5 ? Date.now() + 60000 : 0 })
    throw new HttpError(401, 'bad_credentials')
  }
  failures.delete(key)
  const token = newToken()
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()
  conn().prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sha256(token), row.id, now(), expires)
  return { ...(loadUser(row.id) as SessionUser), token }
}

export function sessionCookie(token: string): string {
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${secureCookies ? '; Secure' : ''}`
}

export const clearCookie = (): string => `${COOKIE}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`

export function logout(req: Req): void {
  const token = req.cookies[COOKIE]
  if (token) conn().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token))
}

export function loadUser(id: number): SessionUser | null {
  const u = conn().prepare('SELECT id, email, name, role, language, active FROM users WHERE id = ?').get(id) as
    { id: number; email: string; name: string; role: Role; language: string; active: number } | undefined
  if (!u || u.active !== 1) return null
  const siteIds = u.role === 'owner'
    ? null
    : (conn().prepare('SELECT site_id FROM user_sites WHERE user_id = ?').all(id) as { site_id: number }[]).map((r) => r.site_id)
  return { id: u.id, email: u.email, name: u.name, role: u.role, language: u.language, siteIds }
}

/**
 * Current dashboard user. Mutations also need the X-Requested-With header (with the SameSite cookie,
 * this stops other websites from sending requests on the user's behalf).
 */
export function requireUser(req: Req, roles?: Role[]): SessionUser {
  const token = req.cookies[COOKIE]
  if (!token) throw new HttpError(401, 'login_required')
  const s = conn().prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(sha256(token)) as
    { user_id: number; expires_at: string } | undefined
  if (!s || s.expires_at < now()) throw new HttpError(401, 'login_required')
  const user = loadUser(s.user_id)
  if (!user) throw new HttpError(401, 'login_required')
  if (req.method !== 'GET' && req.raw.headers['x-requested-with'] !== 'secreg') throw new HttpError(403, 'csrf')
  if (roles && !roles.includes(user.role)) throw new HttpError(403, 'forbidden')
  return user
}

export function canSeeSite(user: SessionUser, siteId: number): boolean {
  return user.siteIds === null || user.siteIds.includes(siteId)
}

/** SQL fragment + params restricting a query to the user's sites */
export function siteFilter(user: SessionUser, column: string, requested?: number): { sql: string; params: number[] } {
  if (requested) {
    if (!canSeeSite(user, requested)) throw new HttpError(403, 'forbidden')
    return { sql: `${column} = ?`, params: [requested] }
  }
  if (user.siteIds === null) return { sql: '1 = 1', params: [] }
  if (user.siteIds.length === 0) return { sql: '1 = 0', params: [] }
  return { sql: `${column} IN (${user.siteIds.map(() => '?').join(',')})`, params: user.siteIds }
}

// ---------- posts (desktop apps) ----------
export interface Device { id: number; siteId: number; name: string }

export function requireDevice(req: Req): Device {
  const auth = String(req.raw.headers.authorization ?? '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) throw new HttpError(401, 'device_token_required')
  const d = conn().prepare('SELECT id, site_id, name, revoked FROM devices WHERE token_hash = ?').get(sha256(token)) as
    { id: number; site_id: number; name: string; revoked: number } | undefined
  if (!d || d.revoked === 1) throw new HttpError(401, 'device_revoked')
  return { id: d.id, siteId: d.site_id, name: d.name }
}

export const setCookie = (res: ServerResponse, value: string): void => { res.setHeader('Set-Cookie', value) }
