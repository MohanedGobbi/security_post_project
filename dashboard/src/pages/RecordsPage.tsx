import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { Lang } from '@shared/types'
import type { SyncCustom, SyncEntity } from '@shared/sync'
import { formatDateTime, formatDuration } from '@shared/i18n'
import { currentLang } from '@desktop/i18n'
import { downloadCsv, errText, get } from '../api'
import { useDash } from '../App'
import type { RecordRow, Site } from '../types'

type Tab = Exclude<SyncEntity, 'expected'>
const TABS: Tab[] = ['visit', 'vehicle', 'delivery', 'incident', 'patrol', 'key_loan', 'note', 'shift']

/** Incident / note titles are keys */
export function activityTitle(kind: string, title: string, t: TFunction): string {
  if (kind === 'incident' || kind === 'incident_closed') return t(`incidentType.${title}`, { defaultValue: title })
  if (kind === 'note') return t(`notes.cat.${title}`, { defaultValue: title })
  if (kind === 'patrol') return `${t('patrol.checked')}: ${title}`
  return title
}

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/** Columns of each record type: label + text value (also used for the CSV) */
function columns(tab: Tab, t: TFunction, lang: Lang): { label: string; value(d: Record<string, unknown>): string }[] {
  const dt = (v: unknown): string => formatDateTime(v ? s(v) : null, lang)
  const custom = (d: Record<string, unknown>): string =>
    ((d.custom as SyncCustom[] | undefined) ?? []).map((c) => `${c.labels[lang] || c.labels.en || c.labels.fr || c.labels.ar}: ${c.value}`).join(' · ')
  switch (tab) {
    case 'visit': return [
      { label: t('visitor.timeIn'), value: (d) => dt(d.timeIn) },
      { label: t('visitor.timeOut'), value: (d) => (d.timeOut ? dt(d.timeOut) : t('log.status.inside')) },
      { label: t('visitor.fullName'), value: (d) => [d.fullName, d.fullNameAlt].filter(Boolean).join(' / ') },
      { label: t('visitor.idNumber'), value: (d) => s(d.idMasked) },
      { label: t('visitor.company'), value: (d) => s(d.company) },
      { label: t('visitor.host'), value: (d) => s(d.host) },
      { label: t('visitor.purpose'), value: (d) => s(d.purpose) },
      { label: t('visitor.badgeNo'), value: (d) => s(d.badgeNo) },
      { label: t('visitor.duration'), value: (d) => formatDuration(s(d.timeIn), d.timeOut ? s(d.timeOut) : null, lang) },
      { label: t('visitor.guardIn'), value: (d) => s(d.guardIn) },
      { label: t('custom.title'), value: custom }
    ]
    case 'vehicle': return [
      { label: t('visitor.timeIn'), value: (d) => dt(d.timeIn) },
      { label: t('visitor.timeOut'), value: (d) => (d.timeOut ? dt(d.timeOut) : t('log.status.inside')) },
      { label: t('vehicles.plate'), value: (d) => s(d.plate) },
      { label: t('vehicles.type'), value: (d) => t(`vehicleType.${s(d.vehicleType)}`, { defaultValue: s(d.vehicleType) }) },
      { label: t('vehicles.driver'), value: (d) => s(d.driverName) },
      { label: t('visitor.company'), value: (d) => s(d.company) },
      { label: t('vehicles.cargo'), value: (d) => s(d.cargo) },
      { label: t('visitor.guardIn'), value: (d) => s(d.guardIn) },
      { label: t('custom.title'), value: custom }
    ]
    case 'delivery': return [
      { label: t('deliveries.received'), value: (d) => dt(d.time) },
      { label: t('deliveries.recipient'), value: (d) => s(d.recipient) },
      { label: t('deliveries.carrier'), value: (d) => [d.carrier, d.courierName].filter(Boolean).join(' / ') },
      { label: t('deliveries.parcels'), value: (d) => s(d.parcels) },
      { label: t('deliveries.tracking'), value: (d) => s(d.tracking) },
      { label: t('deliveries.pickedUpAt'), value: (d) => (d.pickedUpAt ? dt(d.pickedUpAt) : t('deliveries.waiting')) },
      { label: t('deliveries.pickedUpBy'), value: (d) => s(d.pickedUpBy) }
    ]
    case 'incident': return [
      { label: t('incidents.occurredAt'), value: (d) => dt(d.occurredAt) },
      { label: t('incidents.type'), value: (d) => t(`incidentType.${s(d.type)}`, { defaultValue: s(d.type) }) },
      { label: t('incidents.severity'), value: (d) => t(`severity.${s(d.severity)}`, { defaultValue: s(d.severity) }) },
      { label: t('incidents.location'), value: (d) => s(d.location) },
      { label: t('incidents.description'), value: (d) => s(d.description) },
      { label: t('incidents.action'), value: (d) => s(d.actionTaken) },
      { label: t('incidents.status'), value: (d) => (d.closedAt ? `${t('incidents.closed')} ${dt(d.closedAt)}` : t('incidents.open')) },
      { label: t('incidents.resolution'), value: (d) => s(d.resolution) },
      { label: t('incidents.reportedBy'), value: (d) => s(d.guard) }
    ]
    case 'patrol': return [
      { label: t('shift.started'), value: (d) => dt(d.startedAt) },
      { label: t('shift.endedAt'), value: (d) => (d.endedAt ? dt(d.endedAt) : t('shift.ongoing')) },
      { label: t('activity.guard'), value: (d) => s(d.guard) },
      { label: t('patrol.checked'), value: (d) => `${s(d.done)} / ${s(d.total)}` },
      { label: t('patrol.issues'), value: (d) => ((d.checks as { name: string; status: string | null; note: string }[] | undefined) ?? [])
        .filter((c) => c.status === 'issue').map((c) => `${c.name}: ${c.note}`).join(' · ') },
      { label: t('visitor.notes'), value: (d) => s(d.note) }
    ]
    case 'key_loan': return [
      { label: t('keys.item'), value: (d) => s(d.itemLabel) },
      { label: t('keys.borrower'), value: (d) => [d.borrower, d.borrowerInfo].filter(Boolean).join(' · ') },
      { label: t('keys.outAt'), value: (d) => dt(d.outAt) },
      { label: t('keys.dueAt'), value: (d) => dt(d.dueAt) },
      { label: t('keys.returnedAt'), value: (d) => (d.returnedAt ? dt(d.returnedAt) : t('keys.out')) },
      { label: t('visitor.guardIn'), value: (d) => s(d.guardOut) }
    ]
    case 'note': return [
      { label: t('activity.time'), value: (d) => dt(d.time) },
      { label: t('notes.category'), value: (d) => t(`notes.cat.${s(d.category)}`, { defaultValue: s(d.category) }) },
      { label: t('activity.guard'), value: (d) => s(d.guard) },
      { label: t('notes.text'), value: (d) => s(d.text) }
    ]
    case 'shift': return [
      { label: t('shift.guard'), value: (d) => s(d.guard) },
      { label: t('shift.started'), value: (d) => dt(d.startedAt) },
      { label: t('shift.endedAt'), value: (d) => (d.endedAt ? dt(d.endedAt) : t('shift.ongoing')) },
      { label: t('shift.handover'), value: (d) => s(d.handoverNote) },
      { label: t('shift.acknowledged'), value: (d) => s(d.acknowledgedBy) }
    ]
  }
}

const isoDay = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function RecordsPage(): ReactNode {
  const { t } = useTranslation()
  const { toast } = useDash()
  const lang = currentLang()
  const [tab, setTab] = useState<Tab>('visit')
  const [sites, setSites] = useState<Site[]>([])
  const [q, setQ] = useState({ site: 0, from: isoDay(new Date(Date.now() - 6 * 86400000)), to: isoDay(new Date()), text: '' })
  const [rows, setRows] = useState<RecordRow[] | null>(null)

  useEffect(() => {
    get<Site[]>('/api/sites').then(setSites)
  }, [])

  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams({ entity: tab, from: q.from, to: q.to, q: q.text })
      if (q.site) p.set('site', String(q.site))
      setRows(await get<RecordRow[]>(`/api/records?${p}`))
    } catch (e) {
      toast(errText(e, t), 'error')
    }
  }, [tab, q, t, toast])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250)
    return () => clearTimeout(timer)
  }, [load])

  const cols = columns(tab, t, lang)
  const csv = (): void => {
    if (!rows) return
    downloadCsv(`${tab}_${q.from}_${q.to}.csv`, [t('dash.site'), t('dash.post'), ...cols.map((c) => c.label)],
      rows.map((r) => [r.siteName, r.device, ...cols.map((c) => c.value(r.data))]))
  }

  return (
    <section className="card page-card wide">
      <div className="section-head">
        <h1>{t('dash.nav.records')}</h1>
        <button type="button" onClick={csv} disabled={!rows?.length}>{t('dash.csv')}</button>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>
            {t(`dash.entity.${x}`)}
          </button>
        ))}
      </div>
      <div className="filters">
        <label>{t('dash.site')}
          <select value={q.site} onChange={(e) => setQ({ ...q, site: Number(e.target.value) })}>
            <option value={0}>{t('dash.allSites')}</option>
            {sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label>{t('log.from')}<input type="date" value={q.from} max={q.to} onChange={(e) => setQ({ ...q, from: e.target.value })} /></label>
        <label>{t('log.to')}<input type="date" value={q.to} min={q.from} onChange={(e) => setQ({ ...q, to: e.target.value })} /></label>
        <label className="grow">{t('common.search')}<input value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} dir="auto" /></label>
      </div>
      <p className="muted">{t('log.count', { count: rows?.length ?? 0 })}</p>
      {!rows ? <p>{t('common.loading')}</p> : rows.length === 0 ? <p className="empty">{t('log.none')}</p> : (
        <div className="table-wrap">
          <table className="log-table static">
            <thead><tr><th>{t('dash.site')}</th>{cols.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.device}-${r.localId}`}>
                  <td>{r.siteName}<div className="muted">{r.device}</div></td>
                  {cols.map((c) => <td key={c.label} dir="auto" className="clamp-cell">{c.value(r.data)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
