import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

let key: Buffer | null = null

/** 256-bit key for data encrypted at rest (watchlist ID numbers). Created on first start, keep it with the database backup. */
export function initServerKey(dataDir: string): void {
  const file = join(dataDir, 'server.key')
  if (existsSync(file)) {
    key = Buffer.from(readFileSync(file, 'utf8').trim(), 'base64')
  } else {
    key = randomBytes(32)
    writeFileSync(file, key.toString('base64'), { mode: 0o600 })
  }
}

export function encrypt(text: string): Buffer | null {
  if (!text) return null
  if (!key) throw new Error('key not initialised')
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([c.update(text, 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), body])
}

export function decrypt(blob: Uint8Array | null | undefined): string {
  if (!blob || blob.length < 29 || !key) return ''
  const b = Buffer.from(blob)
  const d = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12))
  d.setAuthTag(b.subarray(12, 28))
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')
}

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex')

/** Random token for sessions / devices (only its hash is stored) */
export const newToken = (): string => randomBytes(32).toString('base64url')

/** Short human code (enrollment, pre-registration): no 0/O/1/I to avoid misreading */
export function newCode(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(length)
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('')
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16)
  return `${salt.toString('hex')}:${scryptSync(pw, salt, 32).toString('hex')}`
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(pw, Buffer.from(salt, 'hex'), 32)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
