import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { RegisterDef } from '@shared/types'
import { can } from '@shared/permissions'
import { labelOf } from '@shared/registers'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import Icon, { type IconName } from '../components/Icon'
import { daysAgo, errorText, todayStr } from '../util'

type Period = 'today' | 'week' | 'month' | 'thisMonth' | 'custom'
const firstOfMonth = (): string => `${todayStr().slice(0, 8)}01`

/**
 * Every printout in one place, one click each: the period report, one register, one entry by its number, the latest
 * handover and equipment check, the people inside, the student problems, the students and the audit trail.
 * Each gives an A4 PDF on the faculty's page, and most an Excel file.
 */
export default function ReportsPage(): ReactNode {
  const { t } = useTranslation()
  const { toast, user } = useApp()
  const lang = currentLang()
  const isAdmin = user.role === 'admin'
  const seesAll = isAdmin || user.role === 'dean'
  const [regs, setRegs] = useState<RegisterDef[]>([])
  const [regId, setRegId] = useState(0)
  const [period, setPeriod] = useState<Period>('today')
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [entryReg, setEntryReg] = useState(0)
  const [entryNo, setEntryNo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.api.registers.list().then((rs) => {
      const usable = rs.filter((r) => r.active)
      setRegs(usable)
      setRegId(usable[0]?.id ?? 0)
      setEntryReg(usable[0]?.id ?? 0)
    }).catch(() => undefined)
  }, [])

  const range = (): { from: string; to: string } => {
    switch (period) {
      case 'today': return { from: todayStr(), to: todayStr() }
      case 'week': return { from: daysAgo(6), to: todayStr() }
      case 'month': return { from: daysAgo(29), to: todayStr() }
      case 'thisMonth': return { from: firstOfMonth(), to: todayStr() }
      default: return from <= to ? { from, to } : { from: to, to: from }
    }
  }
  /** non-administrators see the last 24 hours of a register, whatever the period */
  const regQuery = (registerId: number) => (seesAll ? { registerId, ...range(), text: '', openOnly: false } : { registerId, from: '', to: '', text: '', openOnly: false })

  const run = async (fn: () => Promise<string | null | void>): Promise<void> => {
    setBusy(true)
    try {
      const path = await fn()
      if (path) toast(t('export.saved', { path }))
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** the newest entry of a register (or the one with this number), printed alone */
  const printEntry = (key: string | number, number?: number) => run(async () => {
    const reg = typeof key === 'number' ? regs.find((r) => r.id === key) : regs.find((r) => r.key === key)
    if (!reg) throw new Error('error.notFound')
    const entries = await window.api.registers.entries({ registerId: reg.id, from: '2000-01-01', to: todayStr(), text: '', openOnly: false })
    const e = number ? entries.find((x) => x.number === number) : entries[0]
    if (!e) throw new Error(number ? 'reports.noEntry' : 'reports.nothingYet')
    return window.api.exports.entryPdf(e.id, lang)
  })

  const card = (icon: IconName, title: string, help: string, pdf: () => Promise<string | null | void>, xlsx?: () => Promise<string | null | void>): ReactNode => (
    <div className="report-card">
      <span className="tile-icon"><Icon name={icon} size={24} /></span>
      <div className="grow"><strong>{title}</strong><small className="muted">{help}</small></div>
      <div className="report-actions">
        <button type="button" className="primary" disabled={busy} onClick={() => run(pdf)}><Icon name="printer" size={18} /> PDF</button>
        {xlsx && <button type="button" disabled={busy} onClick={() => run(xlsx)}><Icon name="list" size={18} /> Excel</button>}
      </div>
    </div>
  )
  const hasReg = (key: string): boolean => regs.some((r) => r.key === key)
  const regIdOf = (key: string): number => regs.find((r) => r.key === key)?.id ?? 0
  const exports = can(user, 'exports')

  return (
    <div className="reports-page">
      <div className="section-head"><h1><Icon name="printer" /> {t('reports.title')}</h1></div>
      <p className="hint">{t('reports.intro')}</p>

      {seesAll && (
        <section className="card report-period">
          <strong>{t('print.period')}</strong>
          <div className="seg">
            {(['today', 'week', 'month', 'thisMonth', 'custom'] as Period[]).map((p) => (
              <button key={p} type="button" className={period === p ? 'seg-btn on' : 'seg-btn'} onClick={() => setPeriod(p)}>{t(`reports.period.${p}`)}</button>
            ))}
          </div>
          {period === 'custom' && (
            <span className="report-dates">
              <label>{t('common.from')}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label>{t('common.to')}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            </span>
          )}
        </section>
      )}

      <div className="report-grid">
        {exports && can(user, 'history') && card('list', t('print.everything'), t('print.everythingHelp'),
          () => window.api.exports.pdf({ ...range(), lang }), () => window.api.exports.excel({ ...range(), lang }))}
        {exports && regs.length > 0 && (
          <div className="report-card">
            <span className="tile-icon"><Icon name="book" size={24} /></span>
            <div className="grow"><strong>{t('reports.oneRegister')}</strong>
              <select value={regId} onChange={(e) => setRegId(Number(e.target.value))}>
                {regs.map((r) => <option key={r.id} value={r.id}>{labelOf(r.labels, lang)}</option>)}
              </select>
              {!seesAll && <small className="muted">{t('registers.recent')}</small>}
            </div>
            <div className="report-actions">
              <button type="button" className="primary" disabled={busy || !regId} onClick={() => run(() => window.api.exports.registerPdf(regQuery(regId), lang))}><Icon name="printer" size={18} /> PDF</button>
              <button type="button" disabled={busy || !regId} onClick={() => run(() => window.api.exports.registerXlsx(regQuery(regId), lang))}><Icon name="list" size={18} /> Excel</button>
            </div>
          </div>
        )}
        {exports && regs.length > 0 && (
          <div className="report-card">
            <span className="tile-icon"><Icon name="note" size={24} /></span>
            <div className="grow"><strong>{t('reports.oneEntry')}</strong>
              <span className="report-entry">
                <select value={entryReg} onChange={(e) => setEntryReg(Number(e.target.value))}>
                  {regs.map((r) => <option key={r.id} value={r.id}>{labelOf(r.labels, lang)}</option>)}
                </select>
                <input value={entryNo} onChange={(e) => setEntryNo(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder={t('registers.number')} className="mono" />
              </span>
              <small className="muted">{t('reports.oneEntryHelp')}</small>
            </div>
            <div className="report-actions">
              <button type="button" className="primary" disabled={busy || !entryReg} onClick={() => printEntry(entryReg, Number(entryNo) || undefined)}><Icon name="printer" size={18} /> PDF</button>
            </div>
          </div>
        )}
        {exports && hasReg('shift') && card('users', t('reports.lastHandover'), t('reports.lastHandoverHelp'), () => printEntry('shift'))}
        {exports && hasReg('equipment_check') && card('tool', t('reports.lastEquipment'), t('reports.lastEquipmentHelp'), () => printEntry('equipment_check'))}
        {exports && hasReg('student_problems') && card('qr', t('reports.studentProblems'), seesAll ? t(`reports.period.${period}`) : t('registers.recent'),
          () => window.api.exports.registerPdf(regQuery(regIdOf('student_problems')), lang), () => window.api.exports.registerXlsx(regQuery(regIdOf('student_problems')), lang))}
        {can(user, 'visitors') && card('enter', t('print.inside'), t('print.insideHelp'), async () => { await window.api.exports.evacuation(lang) }, () => window.api.exports.insideXlsx(lang))}
        {exports && can(user, 'students') && card('user', t('print.studentsTitle'), t('print.studentsHelp'),
          () => window.api.students.pdf({ text: '', includeInactive: false }, lang), () => window.api.students.xlsx({ text: '', includeInactive: false }, lang))}
        {isAdmin && card('eye', t('admin.audit'), t('print.auditHelp'),
          () => window.api.exports.auditPdf({ ...range(), userId: null, action: '' }, lang), () => window.api.exports.auditXlsx({ ...range(), userId: null, action: '' }, lang))}
      </div>
    </div>
  )
}
