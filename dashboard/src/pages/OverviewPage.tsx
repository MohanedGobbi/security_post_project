import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateTime, formatDuration, formatTime } from '@shared/i18n'
import { currentLang } from '@desktop/i18n'
import Icon from '@desktop/components/Icon'
import { errText, get } from '../api'
import { useDash } from '../App'
import type { ActivityEvent, RecordRow, SiteOverview } from '../types'
import { activityTitle } from './RecordsPage'

const today = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function InsideDialog({ site, onClose }: { site: SiteOverview; onClose(): void }): ReactNode {
  const { t } = useTranslation()
  const [rows, setRows] = useState<RecordRow[] | null>(null)
  const lang = currentLang()
  useEffect(() => {
    get<RecordRow[]>(`/api/inside?site=${site.id}`).then(setRows)
  }, [site.id])
  return (
    <div className="modal" role="dialog" aria-modal onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="card modal-card wide">
        <h2>{t('home.insideNow')} · {site.name}</h2>
        {!rows ? <p>{t('common.loading')}</p> : rows.length === 0 ? <p className="empty">{t('home.nobodyInside')}</p> : (
          <ul className="inside-list">
            {rows.map((r) => (
              <li key={`${r.device}-${r.localId}`}>
                <div className="who-col">
                  <strong dir="auto">{String(r.data.fullName)}</strong>
                  <span className="muted" dir="auto">{[r.data.company, r.data.host && `→ ${r.data.host}`].filter(Boolean).join(' ')}</span>
                </div>
                <div className="meta-col">
                  {r.data.badgeNo ? <span className="badge-chip">#{String(r.data.badgeNo)}</span> : null}
                  <span>{t('home.since', { time: formatTime(String(r.data.timeIn), lang) })}</span>
                  <span className="muted">{formatDuration(String(r.data.timeIn), null, lang)}</span>
                </div>
                <span className="muted">{r.device}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="actions"><button type="button" onClick={onClose} autoFocus>{t('common.close')}</button></div>
      </div>
    </div>
  )
}

export default function OverviewPage(): ReactNode {
  const { t } = useTranslation()
  const { toast, go, me } = useDash()
  const [sites, setSites] = useState<SiteOverview[] | null>(null)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [inside, setInside] = useState<SiteOverview | null>(null)
  const [updated, setUpdated] = useState<Date | null>(null)
  const lang = currentLang()

  const load = useCallback(async () => {
    try {
      const d = today()
      const [s, a] = await Promise.all([get<SiteOverview[]>('/api/overview'), get<ActivityEvent[]>(`/api/activity?from=${d}&to=${d}`)])
      setSites(s)
      setEvents(a.slice(0, 60))
      setUpdated(new Date())
    } catch (e) {
      toast(errText(e, t), 'error')
    }
  }, [t, toast])

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 30000)
    return () => clearInterval(timer)
  }, [load])

  if (!sites) return <p>{t('common.loading')}</p>
  const total = (k: keyof SiteOverview): number => sites.reduce((n, s) => n + (s[k] as number), 0)

  return (
    <div className="dash-overview">
      <div className="section-head">
        <h1>{t('dash.nav.overview')}</h1>
        <span className="muted">{updated && t('dash.updated', { time: formatTime(updated.toISOString(), lang) })}</span>
      </div>
      {sites.length === 0 ? (
        <div className="card empty-state">
          <p>{t('dash.noSites')}</p>
          {me.role === 'owner' && <button type="button" className="primary" onClick={() => go('sites')}>{t('dash.sites.add')}</button>}
        </div>
      ) : (
        <>
          <div className="stats totals">
            <div className="stat accent"><strong>{total('insideNow')}</strong><span>{t('dash.totalInside')}</span></div>
            <div className="stat"><strong>{total('visitsToday')}</strong><span>{t('home.inToday')}</span></div>
            <div className="stat"><strong>{total('vehiclesInside')}</strong><span>{t('home.vehiclesInside')}</span></div>
            <div className={`stat ${total('openIncidents') ? 'danger' : ''}`}><strong>{total('openIncidents')}</strong><span>{t('home.openIncidents')}</span></div>
            <div className="stat"><strong>{total('expectedToday')}</strong><span>{t('dash.expectedToday')}</span></div>
            <div className="stat"><strong>{sites.reduce((n, s) => n + s.devices.filter((d) => d.online).length, 0)} / {sites.reduce((n, s) => n + s.devices.length, 0)}</strong><span>{t('dash.postsOnline')}</span></div>
          </div>
          <div className="site-grid">
            {sites.map((s) => (
              <section key={s.id} className="card site-card">
                <div className="site-head">
                  <div><h2>{s.name}</h2>{s.address && <span className="muted">{s.address}</span>}</div>
                </div>
                <div className="site-stats">
                  <button type="button" className="stat accent" onClick={() => setInside(s)}><strong>{s.insideNow}</strong><span>{t('home.inside')}</span></button>
                  <div className="stat"><strong>{s.vehiclesInside}</strong><span>{t('home.vehiclesInside')}</span></div>
                  <div className={`stat ${s.openIncidents ? 'danger' : ''}`}><strong>{s.openIncidents}</strong><span>{t('home.openIncidents')}</span></div>
                  <div className={`stat ${s.parcelsWaiting ? 'warn' : ''}`}><strong>{s.parcelsWaiting}</strong><span>{t('home.parcelsWaiting')}</span></div>
                  <div className="stat"><strong>{s.keysOut}</strong><span>{t('shift.sum.keysOut')}</span></div>
                  <div className="stat"><strong>{s.expectedToday}</strong><span>{t('dash.expectedToday')}</span></div>
                </div>
                <ul className="device-list">
                  {s.devices.length === 0 ? <li className="muted">{t('dash.noPosts')}</li> : s.devices.map((d) => (
                    <li key={d.id}>
                      <span className={`dot ${d.online ? 'on' : 'off'}`} aria-hidden />
                      <span>{d.name}</span>
                      <span className="muted">{d.online ? t('sync.online') : d.lastSeen ? t('dash.lastSeen', { time: formatDateTime(d.lastSeen, lang) }) : t('sync.never')}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <section className="card">
            <h2><Icon name="clock" /> {t('dash.todayActivity')}</h2>
            {events.length === 0 ? <p className="empty">{t('log.none')}</p> : (
              <div className="table-wrap">
                <table className="log-table static">
                  <thead><tr><th>{t('activity.time')}</th><th>{t('dash.site')}</th><th>{t('activity.event')}</th><th>{t('activity.subject')}</th><th>{t('activity.detail')}</th><th>{t('activity.guard')}</th></tr></thead>
                  <tbody>
                    {events.map((e, i) => (
                      <tr key={i}>
                        <td>{formatTime(e.time, lang)}</td><td>{e.site}</td>
                        <td><span className={`tag kind-${e.kind}`}>{t(`activity.kind.${e.kind}`)}</span></td>
                        <td dir="auto"><strong>{activityTitle(e.kind, e.title, t)}</strong></td><td dir="auto" className="clamp-cell">{e.detail}</td><td>{e.guard}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      {inside && <InsideDialog site={inside} onClose={() => setInside(null)} />}
    </div>
  )
}
