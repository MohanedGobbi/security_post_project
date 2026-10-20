import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'

let dataKey: Buffer | null = null

/**
 * Loads (or creates on first run) the 256-bit key used to encrypt personal data.
 * The key file itself is protected by Windows DPAPI through Electron safeStorage,
 * so a copied database is unreadable on another PC / Windows account.
 */
export type KeyState = 'ok' | 'lost'

const keyFile = (): string => join(app.getPath('userData'), 'data.key')

function writeNewKey(): void {
  dataKey = randomBytes(32)
  const encoded = dataKey.toString('base64')
  writeFileSync(keyFile(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(encoded) : Buffer.from('RAW:' + encoded))
}

/**
 * 'lost': the key file exists but Windows can no longer decrypt it. This happens when the program is killed (power cut,
 * crash) within the first seconds of its very first start, before Windows' own key was saved. The caller decides
 * (see index.ts): on a fresh install it starts over, otherwise it stops with a message. Nothing is overwritten here.
 */
export function initKey(): KeyState {
  const file = keyFile()
  if (existsSync(file)) {
    const stored = readFileSync(file)
    try {
      dataKey = stored.subarray(0, 4).toString() === 'RAW:'
        ? Buffer.from(stored.subarray(4).toString(), 'base64')
        : Buffer.from(safeStorage.decryptString(stored), 'base64')
      return 'ok'
    } catch {
      dataKey = randomBytes(32) // placeholder so the database can be opened and inspected; never written
      return 'lost'
    }
  }
  writeNewKey()
  return 'ok'
}

/** Starts over with a new key (only for a fresh install whose key was lost) */
export function replaceKey(): void {
  writeNewKey()
}

function key(): Buffer {
  if (!dataKey) throw new Error('Encryption key not initialised')
  return dataKey
}

/** AES-256-GCM. Output layout: iv(12) | tag(16) | ciphertext */
export function encrypt(data: Buffer | string | null | undefined): Buffer | null {
  if (data == null || data.length === 0) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([cipher.update(typeof data === 'string' ? Buffer.from(data, 'utf8') : data), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body])
}

export function decryptBuffer(blob: Uint8Array | null | undefined): Buffer | null {
  if (!blob || blob.length < 29) return null
  const buf = Buffer.from(blob)
  const decipher = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12))
  decipher.setAuthTag(buf.subarray(12, 28))
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()])
}

export function decryptText(blob: Uint8Array | null | undefined): string {
  return decryptBuffer(blob)?.toString('utf8') ?? ''
}

/** Deterministic keyed hash so an ID number can be looked up without storing it in clear. */
export function idHash(idNumber: string): string {
  return createHmac('sha256', key()).update(normalizeId(idNumber)).digest('hex')
}

/** Keyed hash of a PIN, so the PIN alone finds its owner (PINs are unique). Checked against the scrypt hash too. */
export function pinLookup(pin: string): string {
  return createHmac('sha256', key()).update('pin:' + pin).digest('hex')
}

export function normalizeId(idNumber: string): string {
  return idNumber.toUpperCase().replace(/[\s\-.<\/]/g, '')
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16)
  return `${salt.toString('hex')}:${scryptSync(pin, salt, 32).toString('hex')}`
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(pin, Buffer.from(salt, 'hex'), 32)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
