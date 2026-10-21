import { writeFile } from 'node:fs/promises'
import type { BrowserWindow } from 'electron'
import type { AuditQuery, EntryQuery, Lang, RegisterDef, RegisterEntry, StudentMatch, User } from '@shared/types'
import { formatDateTime, translate } from '@shared/i18n'
import { labelOf, valueText } from '@shared/registers'
import { askSavePath, esc, htmlToPdf, reportHtml, section, tr, type Column, type Section } from './export'
import { entryCorrections, entryForPrint, getRegister, listEntries, listRegisters } from './registers'
import { getVisit, listAudit } from './db'

/**
 * Printouts of the engine registers, one entry, one visit and the audit trail: A4 PDFs with the faculty's header (both logos),
 * saved where the user asks. What a user may print is exactly what they may see on screen: the same functions give the rows.
 */

const periodLabel = (from: string, to: string): string => (from && to ? (from === to ? from : `${from} → ${to}`) : '')
const yesNoOf = (lang: Lang): { yes: string; no: string } => ({ yes: translate(lang, 'common.yes'), no: translate(lang, 'common.no') })
const safeName = (s: string): string => s.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '')

async function savePdf(parent: BrowserWindow | null, name: string, html: string, landscape: boolean): Promise<string | null> {
  const pdf = await htmlToPdf(html, landscape)
  const path = await askSavePath(parent, name, 'pdf')
  if (!path) return null
  await writeFile(path, pdf)
  return path
}

/** One column per field a reader of the register wants: opening fields, then the closing step with its fields. */
function entryColumns(reg: RegisterDef, lang: Lang): Column<RegisterEntry>[] {
  const t = tr(lang)
  const yn = yesNoOf(lang)
  const fieldCol = (f: RegisterDef['fields'][number]): Column<RegisterEntry> => ({
    label: labelOf(f.labels, lang),
    value: (e) => valueText(f, e.values[f.key], yn) + (e.corrected.includes(f.key) ? ` (${t('registers.corrected')})` : '')
  })
  const open = reg.fields.filter((f) => f.active && f.step === 'open').map(fieldCol)
  const close: Column<RegisterEntry>[] = reg.closeLabels
    ? [
        { label: t('registers.status'), value: (e) => t(e.closedAt ? 'registers.closed' : 'registers.open') },
        { label: labelOf(reg.closeLabels, lang), value: (e) => (e.closedAt ? `${e.closedBy ?? ''} · ${formatDateTime(e.closedAt, lang)}` : '') },
        ...reg.fields.filter((f) => f.active && f.step === 'close').map(fieldCol)
      ]
    : []
  return [
    { label: t('registers.number'), value: (e) => String(e.number) },
    { label: t('registers.time'), value: (e) => formatDateTime(e.createdAt, lang), time: true },
    ...open,
    ...close,
    { label: t('print.recordedBy'), value: (e) => e.createdBy }
  ]
}

/** The entries of one register for a period as a section (also used by the whole-period export). */
export function registerSection(reg: RegisterDef, entries: RegisterEntry[], lang: Lang): Section {
  return section(labelOf(reg.labels, lang), entryColumns(reg, lang), [...entries].reverse())
}

/** Sections for every register this user may browse, for the whole-period PDF / Excel export (administrators). */
export function registersSections(user: User, from: string, to: string, lang: Lang): Section[] {
  if (user.role !== 'admin') return []
  return listRegisters(user)
    .filter((r) => r.active)
    .map((r) => registerSection(r, listEntries({ registerId: r.id, from, to, text: '', openOnly: false }, user), lang))
}

export async function exportRegisterPdf(parent: BrowserWindow | null, user: User, q: EntryQuery, lang: Lang): Promise<string | null> {
  const reg = getRegister(q.registerId)
  if (!reg) throw new Error('error.notFound')
  const entries = listEntries(q, user)
  const t = tr(lang)
  const period = user.role === 'admin' ? periodLabel(q.from, q.to) : t('registers.recent')
  const intro = `<p>${esc(t('registers.openedOn', { date: formatDateTime(reg.openedAt, lang), name: reg.openedBy || '—' }))}</p>`
  const html = reportHtml(lang, labelOf(reg.labels, lang), period, [registerSection(reg, entries, lang)], user.name, intro)
  return savePdf(parent, `register_${safeName(reg.key)}_${q.from || 'recent'}_${q.to || ''}.pdf`, html, true)
}

/** One entry as a sheet: every field, who recorded and closed it, and its corrections. */
export async function exportEntryPdf(parent: BrowserWindow | null, user: User, entryId: number, lang: Lang): Promise<string | null> {
  const { reg, entry } = entryForPrint(entryId, user)
  const t = tr(lang)
  const yn = yesNoOf(lang)
  const shown = reg.fields.filter((f) => (f.step === 'open' || entry.closedAt) && (f.active || entry.values[f.key] !== undefined))
  const rows = shown.map((f) => {
    const mark = entry.corrected.includes(f.key) ? ` <small>(${esc(t('registers.corrected'))})</small>` : ''
    return `<tr><th>${esc(labelOf(f.labels, lang))}</th><td>${esc(valueText(f, entry.values[f.key], yn))}${mark}</td></tr>`
  }).join('')
  const corrections = entryCorrections(entry.id)
  const fieldOf = (key: string): RegisterDef['fields'][number] | undefined => reg.fields.find((f) => f.key === key)
  const fixes = corrections.length
    ? `<h2>${esc(t('registers.corrections'))}</h2><table><tbody>${corrections.map((c) => {
        const f = fieldOf(c.fieldKey)
        return `<tr><td>${esc(f ? labelOf(f.labels, lang) : c.fieldKey)}</td><td>${esc(valueText(f, c.oldValue, yn))} → ${esc(valueText(f, c.newValue, yn))}</td>` +
          `<td>${esc(c.reason)}</td><td>${esc(`${c.by} · ${formatDateTime(c.at, lang)}`)}</td></tr>`
      }).join('')}</tbody></table>`
    : ''
  const closed = entry.closedAt && reg.closeLabels
    ? `<div>${esc(labelOf(reg.closeLabels, lang))}: <b>${esc(entry.closedBy ?? '')}</b> · ${esc(formatDateTime(entry.closedAt, lang))}</div>`
    : ''
  const intro = `<table class="detail"><tbody>${rows}</tbody></table>${fixes}
    <div class="sign"><div>${esc(t('registers.recordedBy', { name: entry.createdBy }))}<br>${esc(formatDateTime(entry.createdAt, lang))}</div>
    ${closed ? `<div>${closed}</div>` : ''}</div>`
  const html = reportHtml(lang, labelOf(reg.labels, lang), `${t('registers.details', { n: entry.number })} · ${formatDateTime(entry.createdAt, lang)}`, [], user.name, intro, false)
  return savePdf(parent, `${safeName(reg.key)}_${entry.number}.pdf`, html, false)
}

export async function exportAuditPdf(parent: BrowserWindow | null, q: AuditQuery, lang: Lang, userName: string): Promise<string | null> {
  const t = tr(lang)
  const rows = listAudit(q)
  const actionLabel = (a: string): string => {
    const k = `audit.actions.${a}`
    const s = translate(lang, k)
    return s === k ? a : s
  }
  const sec = section(t('admin.audit'), [
    { label: t('audit.time'), value: (r) => formatDateTime(r.time, lang), time: true },
    { label: t('audit.user'), value: (r) => r.user ?? t('audit.system') },
    { label: t('audit.action'), value: (r) => actionLabel(r.action) },
    { label: t('audit.detail'), value: (r) => [r.entity, r.entityId, r.detail].filter((x) => x !== null && x !== '').join(' ') }
  ], rows)
  return savePdf(parent, `audit_${q.from}_${q.to}.pdf`, reportHtml(lang, t('admin.audit'), periodLabel(q.from, q.to), [sec], userName), true)
}

/** A visit record with the visitor's photo and the saved pictures of the ID card. */
export async function exportVisitPdf(parent: BrowserWindow | null, visitId: number, lang: Lang, userName: string): Promise<string | null> {
  const v = getVisit(visitId)
  const t = tr(lang)
  const dt = (s: string | null): string => (s ? formatDateTime(s, lang) : '—')
  const rows: [string, string][] = [
    [t('visitor.fullName'), [v.fullName, v.fullNameAlt].filter(Boolean).join(' / ')],
    [t('visitor.idType'), t(`idType.${v.idType}`)], [t('visitor.idNumber'), v.idNumber], [t('visitor.nationality'), v.nationality],
    [t('visitor.birthDate'), v.birthDate], [t('visitor.phone'), v.phone], [t('visitor.company'), v.company],
    [t('visitor.host'), v.host], [t('visitor.purpose'), v.purpose], [t('visitor.vehiclePlate'), v.vehiclePlate],
    [t('visitor.timeIn'), `${dt(v.timeIn)} · ${v.guardIn}`], [t('visitor.timeOut'), v.timeOut ? `${dt(v.timeOut)} · ${v.guardOut ?? ''}` : '—'],
    [t('visitor.notes'), v.notes]
  ]
  const table = rows.filter(([, val]) => val).map(([k, val]) => `<tr><th>${esc(k)}</th><td>${esc(val)}</td></tr>`).join('')
  const img = (b: Uint8Array): string => `<img src="data:image/jpeg;base64,${Buffer.from(b).toString('base64')}" style="max-width:48%;max-height:75mm;margin:4px;border:1px solid #999">`
  const pictures = (v.photo ? `<h2>${esc(t('print.photo'))}</h2>${img(v.photo)}` : '') +
    (v.cards.length ? `<h2>${esc(t('print.cardPictures'))}</h2>${v.cards.map(img).join('')}` : '')
  const html = reportHtml(lang, t('print.visitTitle'), `${v.fullName} · ${dt(v.timeIn)}`, [], userName, `<table class="detail"><tbody>${table}</tbody></table>${pictures}`, false)
  return savePdf(parent, `visit_${v.id}.pdf`, html, false)
}

/** The student list as printed: number, names, level, department. Phone, national number and birth date stay in the program. */
export async function exportStudentsPdf(parent: BrowserWindow | null, rows: StudentMatch[], lang: Lang, userName: string): Promise<string | null> {
  const t = tr(lang)
  const sec = section(t('print.studentsTitle'), [
    { label: t('students.studentNo'), value: (m) => m.student.studentNo },
    { label: t('students.fullName'), value: (m) => m.student.fullName },
    { label: t('students.fullNameAlt'), value: (m) => m.student.fullNameAlt },
    { label: t('students.level'), value: (m) => m.student.level },
    { label: t('students.department'), value: (m) => m.student.department },
    { label: t('students.status'), value: (m) => (m.student.active ? '' : t('students.inactive')) }
  ], rows)
  return savePdf(parent, `students_${new Date().toISOString().slice(0, 10)}.pdf`, reportHtml(lang, t('print.studentsTitle'), '', [sec], userName), true)
}
