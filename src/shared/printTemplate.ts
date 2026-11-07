// The page every printout is laid on: the official header of the faculty's paper books (their logos on both sides), a title
// block with what was printed, when and by whom, the content, signature boxes, and the fine print. Used by the program's PDFs
// (src/main/export.ts) and by the web demo, which prints the same page from the browser.
import type { Lang } from './types'
import { isRtl, translate } from './i18n'

export const esc = (s: string): string => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** the official lines above the logos, as on the paper registers */
export const OFFICIAL_HEADER = [
  'الجمهورية الجزائرية الديمقراطية الشعبية',
  'وزارة التعليم العالي والبحث العلمي',
  'جامعة غرداية',
  'كلية الحقوق والعلوم السياسية',
  'مكتب الأمن الداخلي للكلية'
]

export interface PrintTable { title: string; head: string[]; rows: string[][]; /** columns (by index) that hold a time: kept on one line */ timeCols?: number[] }

export interface PrintPage {
  lang: Lang
  title: string
  /** what the printout covers: a period, an entry number, a person */
  subtitle: string
  /** logo images (data addresses or URLs): the faculty's first, then the university's and AFAK's */
  logos: string[]
  /** who printed it (the time is added) */
  printedBy: string
  /** HTML put before the tables (already escaped) */
  intro?: string
  tables?: PrintTable[]
  /** signature boxes at the end: their captions */
  signatures?: string[]
  landscape?: boolean
  /** the fine print and page numbers in the page itself (a browser printing the page); a PDF made by the program puts them in its own footer */
  footerInPage?: boolean
}

export function tableHtml(t: PrintTable): string {
  const head = t.head.map((h) => `<th>${esc(h)}</th>`).join('')
  const body = t.rows.map((r) => `<tr>${r.map((c, i) => `<td${t.timeCols?.includes(i) ? ' class="time"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')
  return `<section class="block"><h2>${esc(t.title)} <small>(${t.rows.length})</small></h2>${t.rows.length
    ? `<table class="grid"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
    : `<p class="none">${esc('—')}</p>`}</section>`
}

/** label / value pairs as a two-column sheet (one entry, one visit) */
export function detailHtml(pairs: [string, string][]): string {
  return `<table class="detail"><tbody>${pairs.filter(([, v]) => v).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`
}

function when(lang: Lang): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return translate(lang, 'print.printedOn', { date })
}

export function printHtml(p: PrintPage): string {
  const t = (k: string, v?: Record<string, string | number>): string => translate(p.lang, k, v)
  const rtl = isRtl(p.lang)
  const [first, ...others] = p.logos
  const logo = (src: string | undefined): string => (src ? `<img src="${src}" alt="">` : '')
  const signs = p.signatures?.length
    ? `<section class="signs">${p.signatures.map((s) => `<div><span>${esc(s)}</span></div>`).join('')}</section>` : ''
  const fine = p.footerInPage ? `<footer class="fine">${esc(t('print.finePrint'))}</footer>` : ''
  return `<!doctype html><html lang="${p.lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(p.title)}</title><style>
  @page { size: A4 ${p.landscape ? 'landscape' : 'portrait'}; margin: 12mm 12mm 14mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Cairo", "Segoe UI", Tahoma, "DejaVu Sans", Arial, sans-serif; font-size: 9.5pt; color: #111; margin: 0; }
  .official { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; border-bottom: 2.5px solid #0f4426; padding-bottom: 6px; }
  .official .lines { text-align: center; line-height: 1.45; font-size: 9.5pt; }
  .official .lines b { font-size: 10.5pt; }
  .official .side { display: flex; gap: 6px; align-items: center; }
  .official .side:last-child { justify-content: flex-end; }
  .official img { height: 58px; width: auto; }
  .titlebar { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin: 10px 0 8px; padding: 8px 12px;
    background: #e3f1e7; border-radius: 6px; border: 1px solid #b9d4c1; }
  .titlebar h1 { font-size: 15pt; margin: 0; color: #0f4426; }
  .titlebar .sub { font-size: 10pt; color: #333; margin-top: 2px; }
  .titlebar .meta { text-align: end; color: #444; font-size: 8.5pt; line-height: 1.5; }
  h2 { font-size: 11pt; margin: 12px 0 5px; color: #0f4426; } h2 small { font-weight: 400; color: #666; }
  table { width: 100%; border-collapse: collapse; }
  .grid th, .grid td { border: 1px solid #9aa79f; padding: 3px 5px; text-align: start; vertical-align: top; overflow-wrap: anywhere; }
  .grid th { background: #0f4426; color: #fff; font-weight: 600; }
  .grid tr:nth-child(even) td { background: #f3f7f4; }
  .grid td.time { white-space: nowrap; }
  thead { display: table-header-group; } tr { break-inside: avoid; }
  .detail th, .detail td { border: 1px solid #9aa79f; padding: 5px 8px; text-align: start; vertical-align: top; }
  .detail th { width: 32%; background: #e3f1e7; color: #0f4426; } .detail td { font-size: 10.5pt; white-space: pre-wrap; }
  .none { color: #777; }
  .detail-foot { display: flex; gap: 24px; margin-top: 12px; color: #333; }
  .summary { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 8px 0 4px; }
  .summary div { border: 1px solid #b9c6bd; border-radius: 4px; padding: 4px 6px; display: flex; flex-direction: column; }
  .summary b { font-size: 13pt; color: #0f4426; }
  .handover { border: 1.5px solid #0f4426; border-radius: 4px; padding: 8px; white-space: pre-wrap; margin-top: 6px; }
  .pictures img { max-width: 48%; max-height: 75mm; margin: 4px; border: 1px solid #999; }
  .signs { display: flex; gap: 18px; margin-top: 26px; break-inside: avoid; }
  .signs div { flex: 1; border: 1px solid #9aa79f; border-radius: 4px; height: 26mm; padding: 4px 8px; }
  .signs span { font-weight: 600; color: #0f4426; font-size: 9pt; }
  .fine { position: fixed; bottom: 0; inset-inline: 0; text-align: center; font-size: 7pt; color: #777; }
  @media screen { body { max-width: 1100px; margin: 16px auto; padding: 0 16px; } }
</style></head><body>
  <header class="official">
    <div class="side">${logo(first)}</div>
    <div class="lines">${OFFICIAL_HEADER.map((l, i) => (i >= 3 ? `<b>${esc(l)}</b>` : esc(l))).join('<br>')}</div>
    <div class="side">${others.map(logo).join('')}</div>
  </header>
  <div class="titlebar">
    <div><h1>${esc(p.title)}</h1>${p.subtitle ? `<div class="sub">${esc(p.subtitle)}</div>` : ''}</div>
    <div class="meta">${esc(when(p.lang))}<br>${esc(t('print.printedBy', { name: p.printedBy }))}</div>
  </div>
  ${p.intro ?? ''}
  ${(p.tables ?? []).map(tableHtml).join('')}
  ${signs}
  ${fine}
</body></html>`
}
