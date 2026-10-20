import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { RegisterDef, TodayStats, VisitRow } from '@shared/types'
import { labelOf } from '@shared/registers'
import { pageOn, useApp, type Page } from '../App'
import { currentLang } from '../i18n'
import InsideList from '../components/InsideList'
import AlertsPanel from '../components/AlertsPanel'
import Icon, { registerIcon, type IconName } from '../components/Icon'
import { errorText } from '../util'
import { BRAND } from '../brand'

const TILES: { page: Page; key: string; icon: IconName; kbd: string; cls: string }[] = [
  { page: 'in', key: 'nav.visitorIn', icon: 'enter', kbd: 'F2', cls: 'tile-in' },
  { page: 'out', key: 'nav.visitorOut', icon: 'exit', kbd: 'F3', cls: 'tile-out' },
  { page: 'expected', key: 'nav.expected', icon: 'calendar', kbd: 'F12', cls: 'tile-expected' },
  { page: 'vehicles', key: 'nav.vehicles', icon: 'car', kbd: 'F4', cls: 'tile-car' },
  { page: 'deliveries', key: 'nav.deliveries', icon: 'box', kbd: 'F5', cls: 'tile-box' },
  { page: 'incidents', key: 'nav.incidents', icon: 'alert', kbd: 'F6', cls: 'tile-incident' },
  { page: 'patrols', key: 'nav.patrols', icon: 'shield', kbd: 'F10', cls: 'tile-patrol' },
  { page: 'keys', key: 'nav.keys', icon: 'key', kbd: 'F11', cls: 'tile-key' },
  { page: 'notes', key: 'nav.notes', icon: 'note', kbd: 'F7', cls: 'tile-note' }
]

export default function HomePage(): ReactNode {
  const { t } = useTranslation()
  const { go, toast, alerts, features, openRegister } = useApp()
  const on = features.modules
  const [stats, setStats] = useState<TodayStats | null>(null)
  const [inside, setInside] = useState<VisitRow[]>([])
  const [registers, setRegisters] = useState<RegisterDef[]>([])

  // each register is one more tile: its name and a light icon, nothing else
  useEffect(() => {
    window.api.registers.list().then((rs) => setRegisters(rs.filter((r) => r.active))).catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    if (BRAND.homeTilesOnly) return
    const [s, i] = await Promise.all([window.api.visits.stats(), window.api.visits.insideNow()])
    setStats(s)
    setInside(i)
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 60000)
    return () => clearInterval(timer)
  }, [load])

  const evacuation = async (): Promise<void> => {
    try {
      await window.api.exports.evacuation(currentLang())
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  const stat = (value: number | undefined, key: string, page?: Page, cls = ''): ReactNode => (
    <button type="button" className={`stat ${cls}`} onClick={() => page && go(page)} disabled={!page}>
      <strong>{value ?? '–'}</strong><span>{t(key)}</span>
    </button>
  )

  const tiles = (
      <section className="actions-grid">
        {TILES.filter((x) => pageOn(x.page, features)).map((x) => (
          <button key={x.page} type="button" className={`tile ${x.cls}`} onClick={() => go(x.page)}>
            <span className="tile-icon"><Icon name={x.icon} size={30} /></span>
            <strong>{t(x.key)}</strong><kbd>{x.kbd}</kbd>
          </button>
        ))}
        {registers.map((r) => (
          <button key={`r${r.id}`} type="button" className="tile tile-register" onClick={() => openRegister(r.id)}>
            <span className="tile-icon"><Icon name={registerIcon(r.icon)} size={30} /></span>
            <strong>{labelOf(r.labels, currentLang())}</strong>
          </button>
        ))}
      </section>
  )
  // the organisation asked for a calm home screen: one tile per task or register, nothing else
  if (BRAND.homeTilesOnly) return <div className="home tiles-only">{tiles}</div>

  return (
    <div className="home">
      {tiles}

      <div className="stack">
        <AlertsPanel alerts={alerts} />
        <section className="card inside-card">
          <div className="stats">
            {stat(stats?.inside, 'home.inside', 'out', 'accent')}
            {on.vehicles && stat(stats?.vehiclesInside, 'home.vehiclesInside', 'vehicles')}
            {on.deliveries && stat(stats?.parcelsWaiting, 'home.parcelsWaiting', 'deliveries', stats?.parcelsWaiting ? 'warn' : '')}
            {on.incidents && stat(stats?.openIncidents, 'home.openIncidents', 'incidents', stats?.openIncidents ? 'danger' : '')}
            {stat(stats?.inToday, 'home.inToday')}
            {stat(stats?.outToday, 'home.outToday')}
          </div>
          <div className="section-head">
            <h2>{t('home.insideNow')}</h2>
            <button type="button" className="warn-outline" onClick={evacuation} disabled={inside.length === 0}>{t('home.evacuation')}</button>
          </div>
          <InsideList rows={inside} onChanged={load} emptyText={t('home.nobodyInside')} />
        </section>
      </div>
    </div>
  )
}
