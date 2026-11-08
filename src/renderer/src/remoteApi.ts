import { buildApi } from '@shared/buildApi'

/** Starts the api for a browser (the dean's, over the faculty network): every call is a POST to the program on the security PC. */
async function rpc(channel: string, args: unknown[]): Promise<unknown> {
  const res = await fetch('rpc', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, args }) })
  const body = (await res.json()) as { ok: boolean; result?: unknown; error?: string; files?: { name: string; data: string }[] }
  if (!body.ok) throw new Error(body.error || 'error.forbidden')
  // a PDF or Excel file made for this call is saved by the browser
  for (const f of body.files ?? []) {
    const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes]))
    const a = document.createElement('a')
    a.href = url
    a.download = f.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
  return body.files?.length ? body.files[0].name : (body.result ?? undefined)
}

export function installRemoteApi(): void {
  if ((window as unknown as { api?: unknown }).api) return
  ;(window as unknown as { api: unknown }).api = buildApi((channel) => (...args) => rpc(channel, args))
}
