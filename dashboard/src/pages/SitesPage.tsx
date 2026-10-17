import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@shared/i18n'
import { currentLang } from '@desktop/i18n'
import { errText, get, patch, post } from '../api'
import { useDash } from '../App'
import type { Device, Site } from '../types'

/** Sites and the posts (reception PCs) linked to them */
export default function SitesPage(): ReactNode {
  const { t } = useTranslation()
  const { toast, me } = useDash()
  const owner = me.role === 'owner'
  const lang = currentLang()
  const [sites, setSites] = useState<Site[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [code, setCode] = useState<{ siteId: number; code: string; expiresAt: string } | null>(null)
  const [f, setF] = useState({ name: '', address: '' })

  const load = useCallback(() => {
    get<Site[]>('/api/sites').then(setSites)
    get<Device[]>('/api/devices').then(setDevices)
  }, [])
  useEffect(load, [load])

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      load()
    } catch (e) {
      toast(errText(e, t), 'error')
    }
  }

  const add = (e: FormEvent): void => {
    e.preventDefault()
    void run(async () => {
      await post('/api/sites', f)
      setF({ name: '', address: '' })
    })
  }

  const newCode = (siteId: number): Promise<void> => run(async () => {
    const r = await post<{ code: string; expiresAt: string }>(`/api/sites/${siteId}/enroll-code`)
    setCode({ siteId, ...r })
  })

  return (
    <div className="page-card wide">
      <h1>{t('dash.nav.sites')}</h1>
      <div className="site-grid">
        {sites.map((s) => {
          const posts = devices.filter((d) => d.siteId === s.id)
          return (
            <section key={s.id} className={`card site-card ${s.active ? '' : 'disabled'}`}>
              <div className="site-head">
                <div><h2>{s.name}</h2>{s.address && <span className="muted">{s.address}</span>}</div>
                {owner && (
                  <button type="button" className="link" onClick={() => run(() => patch(`/api/sites/${s.id}`, { active: !s.active }))}>
                    {t(s.active ? 'settings.deactivate' : 'settings.activate')}
                  </button>
                )}
              </div>
              <h3>{t('dash.posts')}</h3>
              <ul className="device-list">
                {posts.length === 0 ? <li className="muted">{t('dash.noPosts')}</li> : posts.map((d) => (
                  <li key={d.id} className={d.revoked ? 'disabled' : ''}>
                    <span className={`dot ${d.online && !d.revoked ? 'on' : 'off'}`} aria-hidden />
                    <span>{d.name}</span>
                    <span className="muted">
                      {d.revoked ? t('dash.revoked') : d.online ? t('sync.online') : d.lastSeen ? t('dash.lastSeen', { time: formatDateTime(d.lastSeen, lang) }) : t('sync.never')}
                      {d.appVersion && ` · v${d.appVersion}`}
                    </span>
                    {owner && !d.revoked && <button type="button" className="link danger-link" onClick={() => run(() => post(`/api/devices/${d.id}/revoke`))}>{t('dash.revoke')}</button>}
                  </li>
                ))}
              </ul>
              {owner && s.active && (
                code?.siteId === s.id ? (
                  <div className="enroll-box">
                    <span className="muted">{t('dash.enroll.instructions')}</span>
                    <dl className="detail-grid">
                      <div><dt>{t('sync.url')}</dt><dd className="mono">{window.location.origin}</dd></div>
                      <div><dt>{t('sync.code')}</dt><dd className="mono enroll-code">{code.code}</dd></div>
                    </dl>
                    <span className="muted">{t('dash.enroll.expires', { time: formatDateTime(code.expiresAt, lang) })}</span>
                  </div>
                ) : (
                  <button type="button" onClick={() => newCode(s.id)}>{t('dash.enroll.button')}</button>
                )
              )}
            </section>
          )
        })}
      </div>
      {owner && (
        <form className="card" onSubmit={add}>
          <h2>{t('dash.sites.add')}</h2>
          <div className="row2">
            <label className="req">{t('dash.sites.name')}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} dir="auto" required /></label>
            <label>{t('dash.sites.address')}<input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} dir="auto" /></label>
          </div>
          <div className="actions"><button className="primary">{t('dash.sites.add')}</button></div>
        </form>
      )}
    </div>
  )
}
