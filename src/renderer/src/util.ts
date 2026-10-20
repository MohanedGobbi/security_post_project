import type { TFunction } from 'i18next'

/** Turns an IPC error ("Error invoking remote method …: Error: error.notFound") into a translated message. */
export function errorText(e: unknown, t: TFunction): string {
  const msg = e instanceof Error ? e.message : String(e)
  // "error.key:arg": a number of seconds, or the key of a register field
  const m = msg.match(/((?:error|login|setup)\.\w+)(?::([\w-]+))?/)
  if (m) return t(m[1], { s: m[2] })
  return t('error.generic', { msg: msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })
}

export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysAgo(n: number): string {
  return todayStr(new Date(Date.now() - n * 86400000))
}

export const CAMERA_KEY = 'cameraId'

export function savedCameraId(): string | null {
  try {
    return localStorage.getItem(CAMERA_KEY)
  } catch {
    return null
  }
}

export function saveCameraId(id: string): void {
  try {
    localStorage.setItem(CAMERA_KEY, id)
  } catch {
    // storage unavailable
  }
}

export function bytesToUrl(bytes: Uint8Array | null, type = 'image/jpeg'): string | null {
  return bytes ? URL.createObjectURL(new Blob([bytes as BlobPart], { type })) : null
}
