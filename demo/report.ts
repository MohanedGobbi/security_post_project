// In the demo, PDF exports open the printout in a new tab, on the same page as the program's PDFs (src/shared/printTemplate.ts),
// and the browser's print dialog saves it as PDF. Excel exports download a CSV.
import type { Lang } from '@shared/types'
import { printHtml, type PrintTable } from '@shared/printTemplate'
import { BRAND } from '@renderer/brand'

export interface ReportSection { title: string; head: string[]; rows: string[][]; timeCols?: number[] }

export interface ReportOptions {
  /** who prints it (the demo's logged-in account) */
  printedBy?: string
  signatures?: string[]
  landscape?: boolean
}

export function openReport(lang: Lang, title: string, subtitle: string, sections: ReportSection[], extraHtml = '', o: ReportOptions = {}): void {
  const html = printHtml({
    lang, title, subtitle, logos: [BRAND.logo, BRAND.logo2, BRAND.logo3].filter(Boolean).map((u) => new URL(u, location.href).href),
    printedBy: o.printedBy ?? '', intro: extraHtml, tables: sections as PrintTable[], signatures: o.signatures,
    landscape: o.landscape ?? true, footerInPage: true
  }).replace('</body>', '<script>window.onload = () => setTimeout(() => window.print(), 300)</script></body>')
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
