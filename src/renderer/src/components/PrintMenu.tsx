import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Lang, RegisterDef } from '@shared/types'
import { can } from '@shared/permissions'
import { labelOf } from '@shared/registers'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import Icon from './Icon'
import { daysAgo, errorText, todayStr } from '../util'

type Period = 'today' | 'week' | 'month'
const FROM: Record<Period, () => string> = { today: () => todayStr(), week: () => daysAgo(6), month: () => daysAgo(29) }

/** One place to print anything: opened by the Print button of the top bar or Ctrl+P. */
export default function PrintMenu({ onClose }: { onClose(): void }): ReactNode {
  const { t } = useTranslation()
  const { toast, user, features } = useApp()
  const lang = currentLang()
  const [regs, setRegs] = useState<RegisterDef[]>([])
  const [regId, setRegId] = useState(0)
  const [period, setPeriod] = useState<Period>('today')
  const [busy, setBusy] = useState(false)
  const isAdmin = user.role === 'admin'

  useEffect(() => {
    window.api.registers.list().then((rs) => {
      const usable = rs.filter((r) => r.active)
      setRegs(usable)
      setRegId(usable[0]?.id ?? 0)
    }).catch(() => undefined)
  }, [])

  const run = async (fn: () => Promise<string | null | void>): Promise<void> => {
    setBusy(true)
    try {
      const path = await fn()
      if (path) {
        toast(t('export.saved', { path }))
        onClose()
      }
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setBusy(false)
    }
  }
  const range = (l: Lang): { from: string; to: string; lang: Lang } => ({ from: FROM[period](), to: todayStr(), lang: l })
  const item = (icon: 'users' | 'list' | 'book' | 'user' | 'eye', title: string, help: string, go: () => Promise<string | null | void>): ReactNode => (
    <button type="button" className="print-item" disabled={busy} onClick={() => run(go)}>
      <span className="tile-icon"><Icon name={icon} size={22} /></span>
      <span><strong>{title}</strong><small className="muted">{help}</small></span>
    </button>
  )

  return (
    <div className="modal" role="dialog" aria-modal onKeyDown={(e) => e.key === 'Escape' && onClose()} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card modal-card wide">
        <div className="section-head">
          <h2><Icon name="printer" /> {t('print.menuTitle')}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')}><Icon name="x" /></button>
        </div>
        <div className="filters">
          {isAdmin && (
            <label>{t('print.period')}
              <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
                <option value="today">{t('print.today')}</option>
                <option value="week">{t('print.week')}</option>
                <option value="month">{t('print.month')}</option>
              </select>
            </label>
          )}
          {regs.length > 0 && (
            <label className="grow">{t('print.register')}
              <select value={regId} onChange={(e) => setRegId(Number(e.target.value))}>
                {regs.map((r) => <option key={r.id} value={r.id}>{labelOf(r.labels, lang)}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="print-items">
          {regs.length > 0 && can(user, 'exports') && item('book', t('print.thisRegister'), isAdmin ? t(`print.${period}`) : t('registers.recent'),
            () => window.api.exports.registerPdf({ registerId: regId, from: isAdmin ? FROM[period]() : '', to: isAdmin ? todayStr() : '', text: '', openOnly: false }, lang))}
          {can(user, 'visitors') && item('users', t('print.inside'), t('print.insideHelp'), async () => { await window.api.exports.evacuation(lang) })}
          {can(user, 'exports') && can(user, 'history') && item('list', t('print.everything'), t('print.everythingHelp'), () => window.api.exports.pdf(range(lang)))}
          {can(user, 'exports') && can(user, 'students') && item('user', t('print.studentsTitle'), t('print.studentsHelp'), () => window.api.students.pdf({ text: '', includeInactive: false }, lang))}
          {isAdmin && item('eye', t('admin.audit'), t('print.auditHelp'), () => window.api.exports.auditPdf({ from: FROM[period](), to: todayStr(), userId: null, action: '' }, lang))}
        </div>
        {features.modules.shifts && <p className="hint">{t('print.shiftHint')}</p>}
      </div>
    </div>
  )
}
