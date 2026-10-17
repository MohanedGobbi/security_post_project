import type { TFunction } from 'i18next'

export class ApiError extends Error {
  code: string
  status: number
  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

/** Web demo build (Vercel): no server, the calls are answered in the browser */
const DEMO = import.meta.env.VITE_DEMO === '1'

/** Same-origin JSON call; the session is the HttpOnly cookie, the header is the server's CSRF check. */
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (DEMO) {
    const { demoFetch, DemoHttpError } = await import('../../demo/dashboard-api')
    try {
      return (await demoFetch(method, path, body)) as T
    } catch (e) {
      if (e instanceof DemoHttpError) throw new ApiError(e.status, e.code)
      throw e
    }
  }
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'secreg' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : null
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? 'server_error')
  return data as T
}

export const get = <T,>(path: string): Promise<T> => api<T>('GET', path)
export const post = <T,>(path: string, body: unknown = {}): Promise<T> => api<T>('POST', path, body)
export const patch = <T,>(path: string, body: unknown): Promise<T> => api<T>('PATCH', path, body)
export const put = <T,>(path: string, body: unknown): Promise<T> => api<T>('PUT', path, body)

/** QR code of a visitor pass, as an object URL (for <img> and the download link) */
export async function preregQrUrl(id: number): Promise<string> {
  const svg = DEMO
    ? await (await import('../../demo/dashboard-api')).demoPreregQr(id)
    : await (await fetch(`/api/prereg/${id}/qr.svg`, { credentials: 'same-origin' })).text()
  return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
}

export function errText(e: unknown, t: TFunction): string {
  const code = e instanceof ApiError ? e.code : 'server_error'
  return t(`dash.err.${code}`, { defaultValue: t('dash.err.server_error') })
}

/** Records table to CSV (UTF-8 with BOM so Excel shows accents and Arabic) */
export function downloadCsv(name: string, header: string[], rows: string[][]): void {
  const cell = (v: string): string => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const csv = '﻿' + [header, ...rows].map((r) => r.map((v) => cell(v ?? '')).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
