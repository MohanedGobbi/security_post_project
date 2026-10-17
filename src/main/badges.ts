import { BrowserWindow } from 'electron'
import type { BadgeSettings, BadgeSize, Lang } from '@shared/types'
import { formatDateTime, isRtl, translate } from '@shared/i18n'
import { QR_BADGE } from '@shared/sync'
import { conn, getSettings, getVisit } from './db'
import { qrSvg } from './export'

/** Page sizes in millimetres (width × height) */
const SIZES: Record<BadgeSize, [number, number]> = {
  cr80: [85.6, 54], // ID-1 plastic card printers
  label62: [62, 100], // 62 mm label rolls (Brother QL…)
  a6: [105, 148] // plain printer, cut or fold
}

const DEFAULTS: BadgeSettings = { printer: '', size: 'cr80', autoPrint: false, showPhoto: true }

export function getBadgeSettings(): BadgeSettings {
  const r = conn().prepare("SELECT value FROM settings WHERE key = 'badge'").get() as { value: string } | undefined
  try {
    return { ...DEFAULTS, ...(r ? (JSON.parse(r.value) as Partial<BadgeSettings>) : {}) }
  } catch {
    return DEFAULTS
  }
}

export function setBadgeSettings(s: BadgeSettings): void {
  const clean: BadgeSettings = {
    printer: String(s.printer ?? '').slice(0, 200),
    size: s.size in SIZES ? s.size : 'cr80',
    autoPrint: !!s.autoPrint,
    showPhoto: !!s.showPhoto
  }
  conn().prepare("INSERT INTO settings (key, value) VALUES ('badge', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(clean))
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

async function badgeHtml(visitId: number, lang: Lang, s: BadgeSettings): Promise<{ html: string; size: [number, number] }> {
  const v = getVisit(visitId)
  if (v.timeOut) throw new Error('error.alreadyOut')
  const [w, h] = SIZES[s.size]
  const landscape = w > h
  const t = (k: string): string => translate(lang, k)
  const site = getSettings()
  const photo = s.showPhoto && v.photo ? `<img class="photo" src="data:image/jpeg;base64,${Buffer.from(v.photo).toString('base64')}" alt="">` : ''
  const qr = await qrSvg(`${QR_BADGE}${visitId}`)
  const html = `<!doctype html><html lang="${lang}" dir="${isRtl(lang) ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
    @page { size: ${w}mm ${h}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: ${w}mm; height: ${h}mm; font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #111; background: #fff; }
    .badge { width: ${w}mm; height: ${h}mm; display: flex; flex-direction: column; overflow: hidden; }
    .band { background: #0f2a44; color: #fff; padding: 1.6mm 3mm; display: flex; justify-content: space-between; align-items: center; }
    .band b { font-size: ${landscape ? 13 : 16}pt; letter-spacing: 0.08em; }
    .band span { font-size: 7pt; opacity: 0.85; max-width: 60%; text-align: end; }
    .body { flex: 1; display: flex; gap: 2.5mm; padding: 2.5mm 3mm; ${landscape ? '' : 'flex-direction: column; align-items: center; text-align: center;'} }
    .photo { width: ${landscape ? 20 : 28}mm; height: ${landscape ? 24 : 32}mm; object-fit: cover; border-radius: 1.5mm; flex: none; }
    .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.6mm; }
    .name { font-size: ${landscape ? 12 : 15}pt; font-weight: 700; line-height: 1.1; }
    .line { font-size: 7.5pt; color: #333; }
    .line b { color: #111; }
    .qr { width: ${landscape ? 18 : 26}mm; height: ${landscape ? 18 : 26}mm; flex: none; align-self: ${landscape ? 'flex-end' : 'center'}; }
    .qr svg { width: 100%; height: 100%; }
    .foot { font-size: 6.5pt; color: #555; padding: 0 3mm 1.6mm; display: flex; justify-content: space-between; }
  </style></head><body><div class="badge">
    <div class="band"><b>${esc(t('badge.visitor'))}</b><span>${esc([site.siteName, site.postName].filter(Boolean).join(' · '))}</span></div>
    <div class="body">${photo}<div class="info">
      <div class="name" dir="auto">${esc(v.fullName)}</div>
      ${v.company ? `<div class="line" dir="auto">${esc(v.company)}</div>` : ''}
      ${v.host ? `<div class="line">${esc(t('badge.visiting'))}: <b dir="auto">${esc(v.host)}</b></div>` : ''}
      <div class="line">${esc(t('visitor.timeIn'))}: <b>${esc(formatDateTime(v.timeIn, lang))}</b></div>
    </div><div class="qr">${qr}</div></div>
    <div class="foot"><span>${v.badgeNo ? `${esc(t('visitor.badgeNo'))}: <b>${esc(v.badgeNo)}</b>` : ''}</span><span>${esc(t('badge.returnAtExit'))}</span></div>
  </div></body></html>`
  return { html, size: [w, h] }
}

async function withBadgeWindow<T>(visitId: number, lang: Lang, s: BadgeSettings, fn: (win: BrowserWindow, size: [number, number]) => Promise<T>): Promise<T> {
  const { html, size } = await badgeHtml(visitId, lang, s)
  // 96 px per inch, so the preview has the real proportions
  const px = (mm: number): number => Math.round((mm / 25.4) * 96)
  const win = new BrowserWindow({ show: false, useContentSize: true, width: px(size[0]), height: px(size[1]), paintWhenInitiallyHidden: true,
    webPreferences: { sandbox: true, javascript: false } })
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await fn(win, size)
  } finally {
    win.destroy()
  }
}

export function printBadge(visitId: number, lang: Lang): Promise<void> {
  const s = getBadgeSettings()
  return withBadgeWindow(visitId, lang, s, (win, [w, h]) => new Promise<void>((resolve, reject) => {
    win.webContents.print({
      silent: !!s.printer,
      deviceName: s.printer || undefined,
      printBackground: true,
      margins: { marginType: 'none' },
      pageSize: { width: Math.round(w * 1000), height: Math.round(h * 1000) }
    }, (ok, reason) => (ok || reason === 'cancelled' ? resolve() : reject(new Error('error.printFailed'))))
  }))
}

/** PNG of the badge, for the preview in Settings */
export function previewBadge(visitId: number, lang: Lang, settings: BadgeSettings): Promise<string> {
  return withBadgeWindow(visitId, lang, { ...getBadgeSettings(), ...settings }, async (win) => {
    await new Promise((r) => setTimeout(r, 150))
    return (await win.webContents.capturePage()).toDataURL()
  })
}

export async function listPrinters(): Promise<string[]> {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return []
  return (await win.webContents.getPrintersAsync()).map((p) => p.name)
}
