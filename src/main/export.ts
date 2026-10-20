import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import ExcelJS from 'exceljs'
import { prepareZXingModule, writeBarcode } from 'zxing-wasm/writer'
import type {
  ActivityItem, CustomEntity, CustomValues, DeliveryRow, ExportRange, IncidentRow, KeyLoan, Lang, NoteRow, PatrolRound,
  ShiftSummary, VehicleRow, VisitRow
} from '@shared/types'
import { fieldLabel, fieldValue, formatDateTime, formatDuration, isRtl, translate } from '@shared/i18n'
import { summaryKeyOn } from '@shared/features'
import { getFeatures, getSettings, insideNow, listNotes, searchVisits } from './db'
import { searchVehicles } from './vehicles'
import { searchDeliveries } from './deliveries'
import { searchIncidents } from './incidents'
import { activity, getShift, shiftSummary } from './shifts'
import { listFields } from './customFields'
import { listCheckpoints, listRounds, QR_PREFIX } from './patrols'
import { searchLoans } from './keys'

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

interface Column<T> { label: string; value: (row: T) => string; time?: boolean }
interface Section { title: string; columns: Column<never>[]; rows: unknown[] }

const section = <T>(title: string, columns: Column<T>[], rows: T[]): Section => ({ title, columns: columns as Column<never>[], rows })
const tr = (lang: Lang) => (k: string, vars?: Record<string, string | number>): string => translate(lang, k, vars)

// ---------- column sets ----------
/** One column per custom field of the entity: active ones, and disabled ones that still have values in these rows */
function customColumns<T extends { custom: CustomValues }>(entity: CustomEntity, lang: Lang, rows: T[]): Column<T>[] {
  return listFields(true)
    .filter((f) => f.entity === entity && (f.active || rows.some((r) => r.custom[String(f.id)])))
    .map((f) => ({ label: fieldLabel(f, lang), value: (r: T) => fieldValue(f, r.custom[String(f.id)], lang) }))
}

function patrolColumns(lang: Lang): Column<PatrolRound>[] {
  const t = tr(lang)
  return [
    { label: t('shift.started'), value: (r) => formatDateTime(r.startedAt, lang), time: true },
    { label: t('shift.endedAt'), value: (r) => (r.endedAt ? formatDateTime(r.endedAt, lang) : t('shift.ongoing')), time: true },
    { label: t('activity.guard'), value: (r) => r.guard },
    { label: t('patrol.checked'), value: (r) => `${r.done} / ${r.total}` },
    { label: t('patrol.issues'), value: (r) => (r.issues ? String(r.issues) : '') },
    { label: t('visitor.notes'), value: (r) => r.note }
  ]
}

function keyColumns(lang: Lang): Column<KeyLoan>[] {
  const t = tr(lang)
  return [
    { label: t('keys.item'), value: (l) => l.itemLabel },
    { label: t('keys.borrower'), value: (l) => [l.borrower, l.borrowerInfo].filter(Boolean).join(' · ') },
    { label: t('keys.outAt'), value: (l) => formatDateTime(l.outAt, lang), time: true },
    { label: t('keys.dueAt'), value: (l) => formatDateTime(l.dueAt, lang), time: true },
    { label: t('keys.returnedAt'), value: (l) => (l.returnedAt ? formatDateTime(l.returnedAt, lang) : t('keys.out')), time: true },
    { label: t('visitor.guardIn'), value: (l) => l.guardOut },
    { label: t('visitor.notes'), value: (l) => l.notes }
  ]
}

function visitColumns(lang: Lang): Column<VisitRow>[] {
  const t = tr(lang)
  return [
    { label: t('visitor.timeIn'), value: (v) => formatDateTime(v.timeIn, lang), time: true },
    { label: t('visitor.timeOut'), value: (v) => formatDateTime(v.timeOut, lang), time: true },
    { label: t('visitor.fullName'), value: (v) => [v.fullName, v.fullNameAlt].filter(Boolean).join(' / ') },
    { label: t('visitor.idType'), value: (v) => t(`idType.${v.idType}`) },
    { label: t('visitor.idNumber'), value: (v) => v.idNumber },
    { label: t('visitor.company'), value: (v) => v.company },
    { label: t('visitor.host'), value: (v) => v.host },
    { label: t('visitor.purpose'), value: (v) => v.purpose },
    { label: t('visitor.badgeNo'), value: (v) => v.badgeNo },
    { label: t('visitor.vehiclePlate'), value: (v) => v.vehiclePlate },
    { label: t('visitor.duration'), value: (v) => formatDuration(v.timeIn, v.timeOut, lang) },
    { label: t('visitor.guardIn'), value: (v) => v.guardIn },
    { label: t('visitor.notes'), value: (v) => v.notes }
  ]
}

function vehicleColumns(lang: Lang): Column<VehicleRow>[] {
  const t = tr(lang)
  return [
    { label: t('visitor.timeIn'), value: (v) => formatDateTime(v.timeIn, lang), time: true },
    { label: t('visitor.timeOut'), value: (v) => formatDateTime(v.timeOut, lang), time: true },
    { label: t('vehicles.plate'), value: (v) => v.plate },
    { label: t('vehicles.type'), value: (v) => t(`vehicleType.${v.vehicleType}`) },
    { label: t('vehicles.color'), value: (v) => v.color },
    { label: t('vehicles.driver'), value: (v) => v.driverName },
    { label: t('visitor.company'), value: (v) => v.company },
    { label: t('vehicles.passengers'), value: (v) => (v.passengers ? String(v.passengers) : '') },
    { label: t('vehicles.cargo'), value: (v) => v.cargo },
    { label: t('visitor.duration'), value: (v) => formatDuration(v.timeIn, v.timeOut, lang) },
    { label: t('visitor.guardIn'), value: (v) => v.guardIn },
    { label: t('visitor.notes'), value: (v) => v.notes }
  ]
}

function deliveryColumns(lang: Lang): Column<DeliveryRow>[] {
  const t = tr(lang)
  return [
    { label: t('deliveries.received'), value: (d) => formatDateTime(d.time, lang), time: true },
    { label: t('deliveries.carrier'), value: (d) => [d.carrier, d.courierName].filter(Boolean).join(' / ') },
    { label: t('deliveries.recipient'), value: (d) => d.recipient },
    { label: t('deliveries.parcels'), value: (d) => String(d.parcels) },
    { label: t('deliveries.tracking'), value: (d) => d.tracking },
    { label: t('visitor.guardIn'), value: (d) => d.guard },
    { label: t('deliveries.pickedUpAt'), value: (d) => formatDateTime(d.pickedUpAt, lang), time: true },
    { label: t('deliveries.pickedUpBy'), value: (d) => d.pickedUpBy },
    { label: t('visitor.notes'), value: (d) => d.notes }
  ]
}

function incidentColumns(lang: Lang): Column<IncidentRow>[] {
  const t = tr(lang)
  return [
    { label: t('incidents.occurredAt'), value: (i) => formatDateTime(i.occurredAt, lang), time: true },
    { label: t('incidents.type'), value: (i) => t(`incidentType.${i.type}`) },
    { label: t('incidents.severity'), value: (i) => t(`severity.${i.severity}`) },
    { label: t('incidents.location'), value: (i) => i.location },
    { label: t('incidents.description'), value: (i) => i.description },
    { label: t('incidents.people'), value: (i) => i.peopleInvolved },
    { label: t('incidents.action'), value: (i) => i.actionTaken },
    { label: t('visitor.guardIn'), value: (i) => i.guard },
    { label: t('incidents.status'), value: (i) => (i.closedAt ? `${t('incidents.closed')} ${formatDateTime(i.closedAt, lang)}` : t('incidents.open')) },
    { label: t('incidents.resolution'), value: (i) => i.resolution },
    { label: t('incidents.photos'), value: (i) => (i.photoCount ? String(i.photoCount) : '') }
  ]
}

function noteColumns(lang: Lang): Column<NoteRow>[] {
  const t = tr(lang)
  return [
    { label: t('activity.time'), value: (n) => formatDateTime(n.time, lang), time: true },
    { label: t('notes.category'), value: (n) => t(`notes.cat.${n.category}`) },
    { label: t('visitor.guardIn'), value: (n) => n.guard },
    { label: t('notes.text'), value: (n) => n.text }
  ]
}

/** Activity titles are keys for incidents and notes */
export function activityTitle(a: ActivityItem, t: (k: string) => string): string {
  if (a.kind === 'incident' || a.kind === 'incident_closed') return t(`incidentType.${a.title}`)
  if (a.kind === 'note') return t(`notes.cat.${a.title}`)
  if (a.kind === 'patrol') return `${t('patrol.checked')}: ${a.title}`
  return a.title
}

function activityColumns(lang: Lang): Column<ActivityItem>[] {
  const t = tr(lang)
  return [
    { label: t('activity.time'), value: (a) => formatDateTime(a.time, lang), time: true },
    { label: t('activity.event'), value: (a) => t(`activity.kind.${a.kind}`) },
    { label: t('activity.subject'), value: (a) => activityTitle(a, t) },
    { label: t('activity.detail'), value: (a) => a.detail },
    { label: t('activity.guard'), value: (a) => a.guard }
  ]
}

// ---------- HTML / PDF ----------
function summaryHtml(lang: Lang, s: ShiftSummary): string {
  const t = tr(lang)
  const cells: [string, number][] = [
    ['shift.sum.visitorsIn', s.visitorsIn], ['shift.sum.visitorsOut', s.visitorsOut], ['shift.sum.vehiclesIn', s.vehiclesIn],
    ['shift.sum.vehiclesOut', s.vehiclesOut], ['shift.sum.parcelsReceived', s.parcelsReceived], ['shift.sum.parcelsPickedUp', s.parcelsPickedUp],
    ['shift.sum.incidents', s.incidents], ['shift.sum.notes', s.notes], ['shift.sum.patrols', s.patrols], ['shift.sum.insideNow', s.insideNow],
    ['shift.sum.vehiclesInside', s.vehiclesInside], ['shift.sum.parcelsWaiting', s.parcelsWaiting], ['shift.sum.openIncidents', s.openIncidents],
    ['shift.sum.keysOut', s.keysOut]
  ]
  const f = getFeatures()
  return `<div class="summary">${cells.filter(([k]) => summaryKeyOn(k.replace('shift.sum.', '') as keyof ShiftSummary, f)).map(([k, v]) => `<div><b>${v}</b><span>${esc(t(k))}</span></div>`).join('')}</div>`
}

function reportHtml(lang: Lang, title: string, subtitle: string, sections: Section[], userName: string, intro = ''): string {
  const t = tr(lang)
  const s = getSettings()
  const tables = sections.map((sec) => {
    const head = sec.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')
    const body = sec.rows.map((r) => `<tr>${sec.columns.map((c) => `<td${c.time ? ' class="time"' : ''}>${esc(c.value(r as never))}</td>`).join('')}</tr>`).join('')
    return `<h2>${esc(sec.title)} <small>(${sec.rows.length})</small></h2>${sec.rows.length
      ? `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>` : '<p class="none">—</p>'}`
  }).join('')
  return `<!doctype html><html lang="${lang}" dir="${isRtl(lang) ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; font-size: 9pt; color: #111; }
    header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 10px; }
    h1 { font-size: 16pt; margin: 0; } h2 { font-size: 12pt; margin: 16px 0 6px; } h2 small { font-weight: 400; color: #555; }
    .meta { text-align: end; color: #444; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #999; padding: 3px 5px; text-align: start; vertical-align: top; }
    th { background: #e8e8e8; } tr:nth-child(even) td { background: #f7f7f7; }
    td { overflow-wrap: break-word; } td.time { white-space: nowrap; }
    thead { display: table-header-group; } tr { break-inside: avoid; }
    .none { color: #777; }
    .summary { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 8px 0 4px; }
    .summary div { border: 1px solid #bbb; border-radius: 4px; padding: 4px 6px; display: flex; flex-direction: column; }
    .summary b { font-size: 13pt; }
    .handover { border: 2px solid #111; border-radius: 4px; padding: 8px; white-space: pre-wrap; margin-top: 6px; }
  </style></head><body>
    <header><div><h1>${esc(title)}</h1><div>${esc([s.siteName, s.postName].filter(Boolean).join(' · '))}</div><div>${esc(subtitle)}</div></div>
    <div class="meta">${esc(t('export.generated', { date: formatDateTime(new Date().toISOString(), lang), user: userName }))}</div></header>
    ${intro}${tables}
  </body></html>`
}

async function htmlToPdf(html: string): Promise<Buffer> {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } })
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await win.webContents.printToPDF({ landscape: true, pageSize: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    win.destroy()
  }
}

async function askSavePath(parent: BrowserWindow | null, defaultName: string, ext: 'pdf' | 'xlsx'): Promise<string | null> {
  // fixed reports folder (or automated tests): save there without asking
  const fixedDir = process.env['SECREG_EXPORT_DIR']
  if (fixedDir) return join(fixedDir, defaultName)
  const opts = { defaultPath: join(app.getPath('documents'), defaultName), filters: [{ name: ext.toUpperCase(), extensions: [ext] }] }
  const res = parent ? await dialog.showSaveDialog(parent, opts) : await dialog.showSaveDialog(opts)
  return res.canceled || !res.filePath ? null : res.filePath
}

const periodLabel = (r: ExportRange): string => (r.from === r.to ? r.from : `${r.from} → ${r.to}`)

/** All registers for a period, oldest first */
function registerSections(r: ExportRange): Section[] {
  const t = tr(r.lang)
  const q = { from: r.from, to: r.to, text: '' }
  // only the modules switched on for this site
  const on = getFeatures().modules
  const visits = searchVisits({ ...q, status: 'all' }).reverse()
  const out = [section(t('export.visitorsTitle'), [...visitColumns(r.lang), ...customColumns('visit', r.lang, visits)], visits)]
  if (on.vehicles) {
    const vehicles = searchVehicles(q).reverse()
    out.push(section(t('vehicles.title'), [...vehicleColumns(r.lang), ...customColumns('vehicle', r.lang, vehicles)], vehicles))
  }
  if (on.deliveries) {
    const deliveries = searchDeliveries(q).reverse()
    out.push(section(t('deliveries.title'), [...deliveryColumns(r.lang), ...customColumns('delivery', r.lang, deliveries)], deliveries))
  }
  if (on.incidents) out.push(section(t('incidents.title'), incidentColumns(r.lang), searchIncidents(q).reverse()))
  if (on.patrols) out.push(section(t('patrol.rounds'), patrolColumns(r.lang), listRounds(q).reverse()))
  if (on.keys) out.push(section(t('keys.title'), keyColumns(r.lang), searchLoans(q).reverse()))
  if (on.notes) out.push(section(t('export.notesTitle'), noteColumns(r.lang), listNotes(r.from, r.to).reverse()))
  return out
}

export async function exportPdf(parent: BrowserWindow | null, r: ExportRange, userName: string): Promise<string | null> {
  const pdf = await htmlToPdf(reportHtml(r.lang, translate(r.lang, 'export.reportTitle'), periodLabel(r), registerSections(r), userName))
  const path = await askSavePath(parent, `register_${r.from}_${r.to}.pdf`, 'pdf')
  if (!path) return null
  await writeFile(path, pdf)
  return path
}

/** Writes the list of people currently inside to a temp PDF and opens it, ready to print. */
export async function exportEvacuation(lang: Lang, userName: string): Promise<string> {
  const people = section(translate(lang, 'export.visitorsTitle'), visitColumns(lang), insideNow())
  const pdf = await htmlToPdf(reportHtml(lang, translate(lang, 'export.evacuationTitle'), formatDateTime(new Date().toISOString(), lang), [people], userName))
  const path = join(app.getPath('temp'), `evacuation_${Date.now()}.pdf`)
  await writeFile(path, pdf)
  await shell.openPath(path)
  return path
}

/** Daily Activity Report of one shift: counters, handover note and the timeline of everything that happened. */
export async function exportShiftReport(parent: BrowserWindow | null, shiftId: number, lang: Lang, userName: string): Promise<string | null> {
  const t = tr(lang)
  const s = getShift(shiftId)
  const end = s.endedAt ?? new Date().toISOString()
  const subtitle = `${t('shift.guard')}: ${s.guard} · ${formatDateTime(s.startedAt, lang)} → ${s.endedAt ? formatDateTime(s.endedAt, lang) : t('shift.ongoing')}`
  const intro = summaryHtml(lang, shiftSummary(s.startedAt, end)) +
    (s.handoverNote ? `<h2>${esc(t('shift.handover'))}</h2><div class="handover">${esc(s.handoverNote)}</div>` : '')
  const timeline = section(t('activity.title'), activityColumns(lang), activity(s.startedAt, end))
  const pdf = await htmlToPdf(reportHtml(lang, t('shift.reportTitle'), subtitle, [timeline], userName, intro))
  const day = s.startedAt.slice(0, 10)
  const path = await askSavePath(parent, `shift_report_${day}_${s.guard.replace(/[^\p{L}\p{N}]+/gu, '_')}.pdf`, 'pdf')
  if (!path) return null
  await writeFile(path, pdf)
  return path
}

export async function exportExcel(parent: BrowserWindow | null, r: ExportRange): Promise<string | null> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'برنامج إدارة الأمن بالكلية'
  const views = [{ state: 'frozen' as const, ySplit: 1, rightToLeft: isRtl(r.lang) }]
  for (const sec of registerSections(r)) {
    // sheet names: max 31 chars, no []:*?/\
    const ws = wb.addWorksheet(sec.title.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31), { views })
    ws.columns = sec.columns.map((c) => ({ header: c.label, width: Math.max(12, Math.min(40, c.label.length + 6)) }))
    for (const row of sec.rows) ws.addRow(sec.columns.map((c) => c.value(row as never)))
    ws.getRow(1).font = { bold: true }
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sec.columns.length } }
  }
  const path = await askSavePath(parent, `register_${r.from}_${r.to}.xlsx`, 'xlsx')
  if (!path) return null
  await wb.xlsx.writeFile(path)
  return path
}

// ---------- checkpoint QR labels ----------
let writerReady = false
function ensureWriter(): void {
  if (writerReady) return
  const wasm = readFileSync(join(app.getAppPath(), 'node_modules/zxing-wasm/dist/writer/zxing_writer.wasm'))
  prepareZXingModule({ overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer } })
  writerReady = true
}

/** QR code as scalable SVG (checkpoint labels, visitor badges) */
export async function qrSvg(text: string): Promise<string> {
  ensureWriter()
  const raw = (await writeBarcode(text, { format: 'QRCode', scale: 8, ecLevel: 'M' })).svg
  // the writer gives fixed width/height without a viewBox: add one so the code scales instead of being cropped
  return raw
    .replace(/<\?xml[^>]*>\s*/, '')
    .replace(/<!DOCTYPE[^>]*>\s*/, '')
    .replace(/<svg width="(\d+)" height="(\d+)"/, '<svg viewBox="0 0 $1 $2"')
}

/** A4 sheet of QR labels, one per active checkpoint, to stick at each patrol point. */
export async function exportCheckpointLabels(parent: BrowserWindow | null, lang: Lang): Promise<string | null> {
  const t = tr(lang)
  const s = getSettings()
  const cps = listCheckpoints(false)
  if (cps.length === 0) throw new Error('error.noCheckpoints')
  const labels: string[] = []
  for (const cp of cps) {
    const svg = await qrSvg(`${QR_PREFIX}${cp.code}`)
    labels.push(`<div class="label"><div class="site">${esc([s.siteName, s.postName].filter(Boolean).join(' · '))}</div>
      <div class="qr">${svg}</div><div class="name">${esc(cp.name)}</div><div class="loc">${esc(cp.location)}</div>
      <div class="code">${esc(cp.code)}</div><div class="hint">${esc(t('patrol.labelHint'))}</div></div>`)
  }
  const html = `<!doctype html><html lang="${lang}" dir="${isRtl(lang) ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; margin: 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
    .label { border: 1.5px dashed #555; border-radius: 4mm; padding: 5mm; text-align: center; break-inside: avoid; height: 82mm; box-sizing: border-box; }
    .site { font-size: 9pt; color: #555; }
    .qr svg { width: 42mm; height: 42mm; }
    .name { font-size: 15pt; font-weight: 700; }
    .loc { font-size: 10pt; color: #333; min-height: 12pt; }
    .code { font-family: Consolas, monospace; font-size: 11pt; letter-spacing: 1px; margin-top: 2mm; }
    .hint { font-size: 8pt; color: #666; }
  </style></head><body><div class="grid">${labels.join('')}</div></body></html>`
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } })
  let pdf: Buffer
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    pdf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    win.destroy()
  }
  const path = await askSavePath(parent, 'checkpoint_labels.pdf', 'pdf')
  if (!path) return null
  await writeFile(path, pdf)
  return path
}
