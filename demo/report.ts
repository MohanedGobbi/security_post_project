// In the demo, PDF / Excel exports open a printable page (the desktop app writes real PDF and .xlsx files).
import type { Lang } from '@shared/types'
import { isRtl } from '@shared/i18n'

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export interface ReportSection { title: string; head: string[]; rows: string[][] }

export function openReport(lang: Lang, title: string, subtitle: string, sections: ReportSection[], extraHtml = ''): void {
  const html = `<!doctype html><html lang="${lang}" dir="${isRtl(lang) ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; font-size: 10pt; margin: 16mm; color: #111; }
    h1 { font-size: 16pt; margin: 0 0 4px; } h2 { font-size: 12pt; margin: 16px 0 6px; } .sub { color: #555; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #999; padding: 3px 5px; text-align: start; vertical-align: top; }
    th { background: #e8e8e8; } .demo { background: #fff3df; border: 1px solid #e0b060; padding: 6px 10px; border-radius: 6px; margin-bottom: 12px; }
    @media print { .demo { display: none; } }
  </style></head><body>
    <div class="demo">Demo · PDF / Excel files are produced by the desktop app; here the report opens for printing.</div>
    <h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div>${extraHtml}
    ${sections.map((s) => `<h2>${esc(s.title)} (${s.rows.length})</h2><table><thead><tr>${s.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${s.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}
    <script>setTimeout(() => window.print(), 300)</script>
  </body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
}

/** CSV with UTF-8 BOM (opens in Excel with accents and Arabic) */
export function downloadCsv(name: string, head: string[], rows: string[][]): void {
  const cell = (v: string): string => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const csv = '﻿' + [head, ...rows].map((r) => r.map((v) => cell(v ?? '')).join(',')).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
