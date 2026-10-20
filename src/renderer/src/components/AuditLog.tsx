import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { AuditRow, RegisterDef, User } from '@shared/types'
import { formatDateTime } from '@shared/i18n'
import { labelOf } from '@shared/registers'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import { daysAgo, errorText, todayStr } from '../util'

/** Administration → Audit trail: who logged in, recorded, viewed, exported or changed what. */
export default function AuditLog(): ReactNode {
  const { t, i18n } = useTranslation()
  const { toast } = useApp()
  const lang = currentLang()
  const [q, setQ] = useState({ from: daysAgo(7), to: todayStr(), userId: 0, action: '' })
  const [rows, setRows] = useState<AuditRow[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [regs, setRegs] = useState<RegisterDef[]>([])

  useEffect(() => {
    window.api.users.list().then(setUsers)
    window.api.registers.list().then(setRegs)
  }, [])
  useEffect(() => {
    window.api.audit.list({ from: q.from, to: q.to, userId: q.userId || null, action: q.action })
      .then(setRows)
      .catch((e) => toast(errorText(e, t), 'error'))
  }, [q, toast, t])

  const actions = useMemo(() => Object.keys(i18n.getResource(lang, 'translation', 'audit.actions') ?? {}), [i18n, lang])
  const actionText = (a: string): string => (actions.includes(a) ? t(`audit.actions.${a}`) : a)

  /** register entries and registers are named by their register; the rest shows what the program recorded */
  const detailText = (r: AuditRow): string => {
    const reg = (id: number | string | null): RegisterDef | undefined => regs.find((x) => x.id === Number(id))
    if (r.entity === 'register_entry') return reg(r.detail) ? labelOf(reg(r.detail)!.labels, lang) : r.detail
    if (r.entity === 'register' && r.entityId) return [reg(r.entityId) ? labelOf(reg(r.entityId)!.labels, lang) : '', r.detail].filter(Boolean).join(' · ')
    // "pin" only marks a PIN-only login: nothing the reader needs
    return r.detail === 'pin' ? '' : r.detail
  }

  return (
    <section className="card">
      <div className="section-head">
        <h2>{t('admin.audit')}</h2>
        <span className="count-pill">{rows.length}</span>
      </div>
      <p className="hint">{t('audit.intro')}</p>
      <div className="filters">
        <label>{t('log.from')}<input type="date" value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} /></label>
        <label>{t('log.to')}<input type="date" value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} /></label>
        <label>{t('audit.user')}
          <select value={q.userId} onChange={(e) => setQ({ ...q, userId: Number(e.target.value) })}>
            <option value={0}>{t('audit.allUsers')}</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label>{t('audit.action')}
          <select value={q.action} onChange={(e) => setQ({ ...q, action: e.target.value })}>
            <option value="">{t('audit.allActions')}</option>
            {actions.map((a) => <option key={a} value={a}>{actionText(a)}</option>)}
          </select>
        </label>
      </div>
      {rows.length === 0 ? <p className="empty">{t('audit.none')}</p> : (
        <table className="log-table audit-table">
          <thead><tr><th>{t('audit.time')}</th><th>{t('audit.user')}</th><th>{t('audit.action')}</th><th>{t('audit.detail')}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.action === 'login_failed' || r.action === 'watchlist_override' ? 'warn-row' : ''}>
                <td className="mono">{formatDateTime(r.time, lang)}</td>
                <td>{r.user ?? <span className="muted">{t('audit.system')}</span>}</td>
                <td>{actionText(r.action)}</td>
                <td dir="auto" className="muted">{detailText(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
