import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  ActivityItem, CustomField, CustomValues, DeliveryRow, IncidentRow, KeyLoan, NoteRow, PatrolRound, PatrolRoundDetail, SearchQuery,
  ShiftRow, VehicleRow, VisitDetail, VisitRow
} from '@shared/types'
import { fieldLabel, fieldValue, formatDateTime, formatDuration, formatTime } from '@shared/i18n'
import { useApp } from '../App'
import type { Module } from '@shared/types'
import { currentLang } from '../i18n'
import { IncidentDialog } from './IncidentsPage'
import Icon from '../components/Icon'
import { customRows, useCustomFields } from '../components/CustomFields'
import { bytesToUrl, errorText, todayStr } from '../util'
import { CardGallery } from '../components/CardPictures'
import PrintButton from '../components/PrintButton'

type Tab = 'visits' | 'vehicles' | 'deliveries' | 'incidents' | 'patrols' | 'keys' | 'notes' | 'shifts' | 'activity'
const TABS: Tab[] = ['visits', 'vehicles', 'deliveries', 'incidents', 'patrols', 'keys', 'notes', 'shifts', 'activity']
const TAB_MODULE: Partial<Record<Tab, Module>> = {
  vehicles: 'vehicles', deliveries: 'deliveries', incidents: 'incidents', patrols: 'patrols', keys: 'keys', notes: 'notes', shifts: 'shifts'
}

interface Data {
  visits: VisitRow[]; vehicles: VehicleRow[]; deliveries: DeliveryRow[]; incidents: IncidentRow[]
  notes: NoteRow[]; shifts: ShiftRow[]; activity: ActivityItem[]; patrols: PatrolRound[]; keys: KeyLoan[]
}

const dayStartIso = (d: string): string => new Date(`${d}T00:00:00`).toISOString()
const dayEndIso = (d: string): string => new Date(`${d}T23:59:59.999`).toISOString()

function PhotoDialog({ load, onClose }: { load(): Promise<Uint8Array | null>; onClose(): void }): ReactNode {
  const { t } = useTranslation()
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  useEffect(() => {
    load().then(setBytes)
  }, [load])
  const url = useMemo(() => bytesToUrl(bytes), [bytes])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return (
    <div className="lightbox" role="dialog" aria-label={t('visitor.photo')} onClick={onClose}>
      {url ? <img src={url} alt="" /> : <span>{t('common.loading')}</span>}
    </div>
  )
}

/** "Label: value" of the custom fields of a row, for compact table cells */
function customSummary(fields: CustomField[], values: CustomValues, lang: ReturnType<typeof currentLang>): string {
  return fields.filter((f) => values[String(f.id)]).map((f) => `${fieldLabel(f, lang)}: ${fieldValue(f, values[String(f.id)], lang)}`).join(' · ')
}

function RoundDialog({ id, onClose }: { id: number; onClose(): void }): ReactNode {
  const { t } = useTranslation()
  const [r, setR] = useState<PatrolRoundDetail | null>(null)
  const lang = currentLang()
  useEffect(() => {
    window.api.patrols.get(id).then(setR)
  }, [id])
  return (
    <div className="modal" role="dialog" aria-modal onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="card modal-card wide">
        <h2>{t('patrol.title')}{r && ` · ${r.guard} · ${formatDateTime(r.startedAt, lang)}`}</h2>
        {!r ? <p>{t('common.loading')}</p> : (
          <>
            <p className="muted">{t('patrol.progress', { done: r.done, total: r.total })}{r.note && ` · ${r.note}`}</p>
            <ul className="check-list">
              {r.checks.map((c) => (
                <li key={c.checkpointId} className={`check-row ${c.status ?? 'todo'}`}>
                  <div className="who-col"><strong>{c.name}</strong>{c.status === 'issue' && <span className="issue-note" dir="auto">{c.note}</span>}</div>
                  <div className="meta-col">{c.time ? `${formatTime(c.time, lang)} · ${t(c.method === 'qr' ? 'patrol.viaQr' : 'patrol.manual')}` : t('patrol.notVisited')}</div>
                  <span className={`tag ${c.status === 'issue' ? 'sev-high' : c.status === 'ok' ? 'inside' : ''}`}>{c.status ? t(`patrol.${c.status}`) : '–'}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="actions"><button type="button" onClick={onClose} autoFocus>{t('common.close')}</button></div>
      </div>
    </div>
  )
}

function DetailDialog({ id, onClose }: { id: number; onClose(): void }): ReactNode {
  const { t } = useTranslation()
  const [v, setV] = useState<VisitDetail | null>(null)
  const fields = useCustomFields('visit', true)
  const lang = currentLang()
  useEffect(() => {
    window.api.visits.get(id).then(setV)
  }, [id])
  const photoUrl = useMemo(() => bytesToUrl(v?.photo ?? null), [v])
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])

  const rows: [string, string][] = v ? [
    ['visitor.fullName', v.fullName], ['visitor.fullNameAlt', v.fullNameAlt],
    ['visitor.idType', t(`idType.${v.idType}`)], ['visitor.idNumber', v.idNumber],
    ['visitor.nationality', v.nationality], ['visitor.birthDate', v.birthDate],
    ['visitor.sex', v.sex === 'M' ? t('visitor.sexM') : v.sex === 'F' ? t('visitor.sexF') : ''],
    ['visitor.phone', v.phone], ['visitor.company', v.company], ['visitor.host', v.host],
    ['visitor.purpose', v.purpose], ['visitor.badgeNo', v.badgeNo], ['visitor.vehiclePlate', v.vehiclePlate],
    ['visitor.timeIn', formatDateTime(v.timeIn, lang)], ['visitor.timeOut', formatDateTime(v.timeOut, lang)],
    ['visitor.duration', formatDuration(v.timeIn, v.timeOut, lang)],
    ['visitor.guardIn', v.guardIn], ['visitor.guardOut', v.guardOut ?? ''], ['visitor.notes', v.notes]
  ] : []
  const extra = v ? customRows(fields, v.custom) : []

  return (
    <div className="modal" role="dialog" aria-modal onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="card modal-card wide">
        <div className="form-head">
          <h2>{t('log.details')}</h2>
          {photoUrl && <img className="visitor-photo big" src={photoUrl} alt={t('visitor.photo')} />}
        </div>
        {!v ? <p>{t('common.loading')}</p> : (
          <>
            <dl className="detail-grid">
              {rows.filter(([, val]) => val).map(([k, val]) => <div key={k}><dt>{t(k)}</dt><dd dir="auto">{val}</dd></div>)}
              {extra.map(([k, val]) => <div key={k}><dt>{k}</dt><dd dir="auto">{val}</dd></div>)}
            </dl>
            <CardGallery cards={v.cards} />
          </>
        )}
        <div className="actions">
          <PrintButton run={(l) => window.api.exports.visitPdf(id, l)} runXlsx={(l) => window.api.exports.visitXlsx(id, l)} disabled={!v} />
          <button type="button" onClick={onClose} autoFocus>{t('common.close')}</button>
        </div>
      </div>
    </div>
  )
}

export default function LogPage(): ReactNode {
  const { t } = useTranslation()
  const { toast, features } = useApp()
  const tabs = TABS.filter((x) => !TAB_MODULE[x] || features.modules[TAB_MODULE[x] as Module])
  const [tab, setTab] = useState<Tab>('visits')
  const [q, setQ] = useState<SearchQuery>({ from: todayStr(), to: todayStr(), text: '', status: 'all' })
  const [data, setData] = useState<Partial<Data>>({})
  const [visitDetail, setVisitDetail] = useState<number | null>(null)
  const [incident, setIncident] = useState<number | null>(null)
  const [roundId, setRoundId] = useState<number | null>(null)
  const vehicleFields = useCustomFields('vehicle', true)
  const deliveryFields = useCustomFields('delivery', true)
  const [photo, setPhoto] = useState<(() => Promise<Uint8Array | null>) | null>(null)
  const [exporting, setExporting] = useState(false)
  const lang = currentLang()

  const load = useCallback(async () => {
    const r = { from: q.from, to: q.to, text: q.text }
    const api = window.api
    const text = q.text.trim().toLowerCase()
    const next: Partial<Data> = {}
    if (tab === 'visits') next.visits = await api.visits.search(q)
    if (tab === 'vehicles') next.vehicles = await api.vehicles.search(r)
    if (tab === 'deliveries') next.deliveries = await api.deliveries.search(r)
    if (tab === 'incidents') next.incidents = await api.incidents.search(r)
    if (tab === 'shifts') next.shifts = await api.shifts.list(r)
    if (tab === 'patrols') next.patrols = await api.patrols.list(r)
    if (tab === 'keys') next.keys = await api.keys.loans(r)
    if (tab === 'notes') {
      next.notes = (await api.notes.list(q.from, q.to)).filter((n) => !text || `${n.text} ${n.guard}`.toLowerCase().includes(text))
    }
    if (tab === 'activity') {
      next.activity = (await api.shifts.activity(dayStartIso(q.from), dayEndIso(q.to)))
        .filter((a) => !text || `${a.title} ${a.detail} ${a.guard}`.toLowerCase().includes(text))
        .reverse()
    }
    setData(next)
  }, [q, tab])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const doExport = async (kind: 'pdf' | 'excel'): Promise<void> => {
    setExporting(true)
    try {
      const path = await window.api.exports[kind]({ from: q.from, to: q.to, lang })
      if (path) toast(t('export.saved', { path }))
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setExporting(false)
    }
  }

  const shiftReport = async (id: number): Promise<void> => {
    try {
      const path = await window.api.exports.shiftReport(id, lang)
      if (path) toast(t('export.saved', { path }))
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  const dt = (iso: string | null): string => formatDateTime(iso, lang)
  const insideTag = <span className="tag inside">{t('log.status.inside')}</span>
  const photoBtn = (fn: () => Promise<Uint8Array | null>): ReactNode => (
    <button type="button" className="icon-btn" aria-label={t('visitor.photo')} onClick={(e) => { e.stopPropagation(); setPhoto(() => fn) }}>
      <Icon name="camera" size={16} />
    </button>
  )
  const activityTitle = (a: ActivityItem): string =>
    a.kind === 'incident' || a.kind === 'incident_closed' ? t(`incidentType.${a.title}`)
      : a.kind === 'note' ? t(`notes.cat.${a.title}`)
        : a.kind === 'patrol' ? `${t('patrol.checked')}: ${a.title}` : a.title

  const count = (data[tab] as unknown[] | undefined)?.length ?? 0

  const table = (head: string[], body: ReactNode): ReactNode => (
    <div className="table-wrap">
      <table className="log-table"><thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{body}</tbody></table>
    </div>
  )

  let content: ReactNode = null
  if (tab === 'visits' && data.visits) {
    content = table(
      [t('visitor.timeIn'), t('visitor.timeOut'), t('visitor.fullName'), t('visitor.idNumber'), t('visitor.company'), t('visitor.host'), t('visitor.badgeNo'), t('visitor.guardIn')],
      data.visits.map((v) => (
        <tr key={v.id} onClick={() => setVisitDetail(v.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setVisitDetail(v.id)}>
          <td>{dt(v.timeIn)}</td><td>{v.timeOut ? dt(v.timeOut) : insideTag}</td>
          <td dir="auto"><strong>{v.fullName}</strong>{v.fullNameAlt && <div className="muted">{v.fullNameAlt}</div>}{v.cardCount > 0 && <span className="tag card-mark" title={t('card.title')}><Icon name="scan" size={12} /> {v.cardCount}</span>}</td>
          <td className="mono" dir="ltr">{v.idNumber}</td><td dir="auto">{v.company}</td><td dir="auto">{v.host}</td>
          <td>{v.badgeNo}</td><td>{v.guardIn}</td>
        </tr>
      ))
    )
  } else if (tab === 'vehicles' && data.vehicles) {
    content = table(
      [t('visitor.timeIn'), t('visitor.timeOut'), t('vehicles.plate'), t('vehicles.type'), t('vehicles.driver'), t('visitor.company'), t('vehicles.cargo'), t('visitor.guardIn'), ...(vehicleFields.length ? [t('custom.title')] : []), ''],
      data.vehicles.map((v) => (
        <tr key={v.id} className="static-row">
          <td>{dt(v.timeIn)}</td><td>{v.timeOut ? dt(v.timeOut) : insideTag}</td><td><span className="plate">{v.plate}</span></td>
          <td>{t(`vehicleType.${v.vehicleType}`)}{v.color && ` · ${v.color}`}</td><td dir="auto">{v.driverName}</td>
          <td dir="auto">{v.company}</td><td dir="auto">{v.cargo}</td><td>{v.guardIn}</td>
          {vehicleFields.length > 0 && <td dir="auto">{customSummary(vehicleFields, v.custom, lang)}</td>}
          <td>{v.hasPhoto && photoBtn(() => window.api.vehicles.photo(v.id))}</td>
        </tr>
      ))
    )
  } else if (tab === 'deliveries' && data.deliveries) {
    content = table(
      [t('deliveries.received'), t('deliveries.recipient'), t('deliveries.carrier'), t('deliveries.parcels'), t('deliveries.tracking'), t('deliveries.pickedUpAt'), t('deliveries.pickedUpBy'), ...(deliveryFields.length ? [t('custom.title')] : []), ''],
      data.deliveries.map((d) => (
        <tr key={d.id} className="static-row">
          <td>{dt(d.time)}</td><td dir="auto"><strong>{d.recipient}</strong></td><td dir="auto">{[d.carrier, d.courierName].filter(Boolean).join(' / ')}</td>
          <td>{d.parcels}</td><td dir="ltr">{d.tracking}</td>
          <td>{d.pickedUpAt ? dt(d.pickedUpAt) : <span className="tag waiting">{t('deliveries.waiting')}</span>}</td>
          <td dir="auto">{d.pickedUpBy}</td>
          {deliveryFields.length > 0 && <td dir="auto">{customSummary(deliveryFields, d.custom, lang)}</td>}
          <td>{d.hasPhoto && photoBtn(() => window.api.deliveries.photo(d.id))}</td>
        </tr>
      ))
    )
  } else if (tab === 'incidents' && data.incidents) {
    content = table(
      [t('incidents.occurredAt'), t('incidents.type'), t('incidents.severity'), t('incidents.location'), t('incidents.description'), t('incidents.status'), t('incidents.reportedBy')],
      data.incidents.map((i) => (
        <tr key={i.id} onClick={() => setIncident(i.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setIncident(i.id)}>
          <td>{dt(i.occurredAt)}</td><td><strong>{t(`incidentType.${i.type}`)}</strong></td>
          <td><span className={`tag sev-${i.severity}`}>{t(`severity.${i.severity}`)}</span></td>
          <td dir="auto">{i.location}</td><td dir="auto" className="clamp-cell">{i.description}</td>
          <td>{i.closedAt ? t('incidents.closed') : <span className="tag sev-high">{t('incidents.open')}</span>}</td><td>{i.guard}</td>
        </tr>
      ))
    )
  } else if (tab === 'patrols' && data.patrols) {
    content = table(
      [t('shift.started'), t('shift.endedAt'), t('activity.guard'), t('patrol.checked'), t('patrol.issues'), t('visitor.notes')],
      data.patrols.map((r) => (
        <tr key={r.id} onClick={() => setRoundId(r.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setRoundId(r.id)}>
          <td>{dt(r.startedAt)}</td><td>{r.endedAt ? dt(r.endedAt) : <span className="tag inside">{t('shift.ongoing')}</span>}</td>
          <td>{r.guard}</td><td><span className={`badge-chip ${r.done < r.total ? 'warn' : ''}`}>{r.done} / {r.total}</span></td>
          <td>{r.issues > 0 && <span className="tag sev-high">{r.issues}</span>}</td><td dir="auto">{r.note}</td>
        </tr>
      ))
    )
  } else if (tab === 'keys' && data.keys) {
    content = table(
      [t('keys.item'), t('keys.borrower'), t('keys.outAt'), t('keys.dueAt'), t('keys.returnedAt'), t('visitor.guardIn'), t('visitor.notes')],
      data.keys.map((l) => (
        <tr key={l.id} className="static-row">
          <td><strong dir="auto">{l.itemLabel}</strong></td><td dir="auto">{l.borrower}{l.borrowerInfo && <div className="muted">{l.borrowerInfo}</div>}</td>
          <td>{dt(l.outAt)}</td><td>{l.dueAt ? dt(l.dueAt) : ''}</td>
          <td>{l.returnedAt ? dt(l.returnedAt) : <span className="tag waiting">{t('keys.out')}</span>}</td><td>{l.guardOut}</td><td dir="auto">{l.notes}</td>
        </tr>
      ))
    )
  } else if (tab === 'notes' && data.notes) {
    content = table(
      [t('activity.time'), t('notes.category'), t('activity.guard'), t('notes.text')],
      data.notes.map((n) => (
        <tr key={n.id} className="static-row">
          <td>{dt(n.time)}</td><td><span className={`tag cat-${n.category}`}>{t(`notes.cat.${n.category}`)}</span></td>
          <td>{n.guard}</td><td dir="auto" className="pre">{n.text}</td>
        </tr>
      ))
    )
  } else if (tab === 'shifts' && data.shifts) {
    content = table(
      [t('shift.guard'), t('shift.started'), t('shift.endedAt'), t('shift.handover'), t('shift.acknowledged'), ''],
      data.shifts.map((s) => (
        <tr key={s.id} className="static-row">
          <td><strong>{s.guard}</strong></td><td>{dt(s.startedAt)}</td><td>{s.endedAt ? dt(s.endedAt) : <span className="tag inside">{t('shift.ongoing')}</span>}</td>
          <td dir="auto" className="pre">{s.handoverNote}</td><td>{s.acknowledgedBy ?? ''}</td>
          <td><button type="button" onClick={() => shiftReport(s.id)}>PDF</button></td>
        </tr>
      ))
    )
  } else if (tab === 'activity' && data.activity) {
    content = table(
      [t('activity.time'), t('activity.event'), t('activity.subject'), t('activity.detail'), t('activity.guard')],
      data.activity.map((a, i) => (
        <tr key={i} className="static-row">
          <td>{dt(a.time)}</td><td><span className={`tag kind-${a.kind}`}>{t(`activity.kind.${a.kind}`)}</span></td>
          <td dir="auto"><strong>{activityTitle(a)}</strong></td><td dir="auto" className="clamp-cell">{a.detail}</td><td>{a.guard}</td>
        </tr>
      ))
    )
  }

  return (
    <section className="card page-card wide">
      <div className="section-head">
        <h1>{t('log.title')}</h1>
        <div className="actions">
          <button type="button" disabled={exporting} onClick={() => doExport('pdf')}>{t('export.pdf')}</button>
          <button type="button" disabled={exporting} onClick={() => doExport('excel')}>{t('export.excel')}</button>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>{t(`log.tab.${x}`)}</button>
        ))}
      </div>
      <div className="filters">
        <label>{t('log.from')}<input type="date" value={q.from} max={q.to} onChange={(e) => setQ({ ...q, from: e.target.value })} /></label>
        <label>{t('log.to')}<input type="date" value={q.to} min={q.from} onChange={(e) => setQ({ ...q, to: e.target.value })} /></label>
        <label className="grow">{t('common.search')}<input value={q.text} placeholder={t('log.text')} dir="auto" onChange={(e) => setQ({ ...q, text: e.target.value })} /></label>
        {tab === 'visits' && (
          <div className="seg">
            {(['all', 'inside', 'left'] as const).map((s) => (
              <button key={s} type="button" className={`seg-btn ${q.status === s ? 'on' : ''}`} onClick={() => setQ({ ...q, status: s })}>{t(`log.status.${s}`)}</button>
            ))}
          </div>
        )}
      </div>
      <p className="muted">{t('log.count', { count })}</p>
      {count === 0 ? <p className="empty">{t('log.none')}</p> : content}
      {visitDetail !== null && <DetailDialog id={visitDetail} onClose={() => setVisitDetail(null)} />}
      {incident !== null && <IncidentDialog id={incident} onClose={() => setIncident(null)} onChanged={load} />}
      {photo && <PhotoDialog load={photo} onClose={() => setPhoto(null)} />}
      {roundId !== null && <RoundDialog id={roundId} onClose={() => setRoundId(null)} />}
    </section>
  )
}
