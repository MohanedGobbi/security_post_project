import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLang } from '@desktop/i18n'
import { errText, get, patch, post } from '../api'
import { useDash } from '../App'
import type { DashUser, Role, Site } from '../types'

const ROLES: Role[] = ['owner', 'supervisor', 'host']

function SitePicker({ sites, value, onChange }: { sites: Site[]; value: number[]; onChange(v: number[]): void }): ReactNode {
  return (
    <div className="chips">
      {sites.map((s) => (
        <button key={s.id} type="button" className={value.includes(s.id) ? 'chip on' : 'chip'}
          onClick={() => onChange(value.includes(s.id) ? value.filter((x) => x !== s.id) : [...value, s.id])}>{s.name}</button>
      ))}
    </div>
  )
}

/** Dashboard accounts (owner only). Guards keep their PIN accounts on the posts. */
export default function UsersPage(): ReactNode {
  const { t } = useTranslation()
  const { toast, me } = useDash()
  const [users, setUsers] = useState<DashUser[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [pwFor, setPwFor] = useState<number | null>(null)
  const [pw, setPw] = useState('')
  const [f, setF] = useState({ email: '', name: '', role: 'host' as Role, password: '', siteIds: [] as number[] })

  const load = useCallback(() => {
    get<DashUser[]>('/api/users').then(setUsers)
  }, [])
  useEffect(() => {
    load()
    get<Site[]>('/api/sites').then(setSites)
  }, [load])

  const run = async (fn: () => Promise<unknown>, ok?: string): Promise<void> => {
    try {
      await fn()
      if (ok) toast(ok)
      load()
    } catch (e) {
      toast(errText(e, t), 'error')
    }
  }

  const add = (e: FormEvent): void => {
    e.preventDefault()
    void run(async () => {
      await post('/api/users', { ...f, language: currentLang() })
      setF({ email: '', name: '', role: 'host', password: '', siteIds: [] })
    }, t('settings.saved'))
  }

  return (
    <div className="page-card wide">
      <section className="card">
        <h1>{t('dash.nav.users')}</h1>
        <p className="muted">{t('dash.usersIntro')}</p>
        <div className="table-wrap">
          <table className="log-table static">
            <thead><tr><th>{t('dash.user.name')}</th><th>{t('dash.user.role')}</th><th>{t('dash.user.sites')}</th><th>{t('settings.active')}</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.active ? '' : 'disabled'}>
                  <td><strong>{u.name}</strong>{u.id === me.id && ' ★'}<div className="muted">{u.email}</div></td>
                  <td>
                    <select value={u.role} onChange={(e) => run(() => patch(`/api/users/${u.id}`, { role: e.target.value }))}>
                      {ROLES.map((r) => <option key={r} value={r}>{t(`dash.roles.${r}`)}</option>)}
                    </select>
                  </td>
                  <td>{u.role === 'owner' ? <span className="muted">{t('dash.allSites')}</span> : (
                    <SitePicker sites={sites} value={u.siteIds ?? []} onChange={(v) => run(() => patch(`/api/users/${u.id}`, { siteIds: v }))} />
                  )}</td>
                  <td>{t(u.active ? 'settings.active' : 'settings.inactive')}</td>
                  <td className="row-actions">
                    {pwFor === u.id ? (
                      <form onSubmit={(e) => { e.preventDefault(); void run(async () => { await patch(`/api/users/${u.id}`, { password: pw }); setPwFor(null); setPw('') }, t('settings.saved')) }}>
                        <input type="password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t('dash.user.newPassword')} autoFocus autoComplete="new-password" />
                        <button className="primary">{t('common.save')}</button>
                        <button type="button" onClick={() => setPwFor(null)}>{t('common.cancel')}</button>
                      </form>
                    ) : (
                      <>
                        <button type="button" onClick={() => { setPwFor(u.id); setPw('') }}>{t('dash.user.resetPassword')}</button>
                        <button type="button" onClick={() => run(() => patch(`/api/users/${u.id}`, { active: !u.active }))}>{t(u.active ? 'settings.deactivate' : 'settings.activate')}</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <form className="card" onSubmit={add}>
        <h2>{t('settings.addUser')}</h2>
        <div className="row3">
          <label className="req">{t('dash.user.name')}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} dir="auto" required /></label>
          <label className="req">{t('dash.user.email')}<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} dir="ltr" required /></label>
          <label>{t('dash.user.role')}
            <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{t(`dash.roles.${r}`)}</option>)}
            </select>
          </label>
        </div>
        <p className="hint">{t(`dash.roleHint.${f.role}`)}</p>
        {f.role !== 'owner' && <label>{t('dash.user.sites')}<SitePicker sites={sites} value={f.siteIds} onChange={(v) => setF({ ...f, siteIds: v })} /></label>}
        <label className="req">{t('dash.user.tempPassword')}<input type="password" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required autoComplete="new-password" /></label>
        <div className="actions"><button className="primary">{t('settings.addUser')}</button></div>
      </form>
    </div>
  )
}
