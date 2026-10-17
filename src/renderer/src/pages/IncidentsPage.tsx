import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { IncidentDetail, IncidentRow, IncidentType, Severity } from '@shared/types'
import { formatDateTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import PhotoPicker, { useImageUrls } from '../components/PhotoPicker'
import PromptDialog from '../components/PromptDialog'
import Icon from '../components/Icon'
import { errorText } from '../util'

const TYPES: IncidentType[] = ['theft', 'intrusion', 'damage', 'fire_alarm', 'medical', 'fight', 'suspicious', 'lost_found', 'safety', 'other']
const SEVERITIES: Severity[] = ['low', 'medium', 'high']
const MAX_PHOTOS = 8

/** value for <input type="datetime-local"> in local time */
const localNow = (): string => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const EMPTY = { type: 'other' as IncidentType, severity: 'medium' as Severity, location: '', description: '', peopleInvolved: '', actionTaken: '' }

export function IncidentDialog({ id, onClose, onChanged }: { id: number; onClose(): void; onChanged?(): void }): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [i, setI] = useState<IncidentDetail | null>(null)
  const [closing, setClosing] = useState(false)
  const [big, setBig] = useState<string | null>(null)
  const lang = currentLang()
  const load = useCallback(() => {
    window.api.incidents.get(id).then(setI)
  }, [id])
  useEffect(load, [load])
  const urls = useImageUrls(i?.photos ?? [])

  const rows: [string, string][] = i ? [
    ['incidents.type', t(`incidentType.${i.type}`)], ['incidents.severity', t(`severity.${i.severity}`)],
    ['incidents.occurredAt', formatDateTime(i.occurredAt, lang)], ['incidents.location', i.location],
    ['incidents.reportedBy', i.guard], ['incidents.status', i.closedAt ? `${t('incidents.closed')} · ${formatDateTime(i.closedAt, lang)}` : t('incidents.open')],
    ['incidents.closedBy', i.closedBy ?? ''], ['incidents.people', i.peopleInvolved]
  ] : []

  return (
    <div className="modal" role="dialog" aria-modal onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && !closing && onClose()}>
      <div className="card modal-card wide">
        <h2>{t('incidents.details')} #{id}</h2>
        {!i ? <p>{t('common.loading')}</p> : (
          <>
            <dl className="detail-grid">
              {rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{t(k)}</dt><dd dir="auto">{v}</dd></div>)}
            </dl>
            <h3>{t('incidents.description')}</h3>
            <p className="pre" dir="auto">{i.description}</p>
            {i.actionTaken && <><h3>{t('incidents.action')}</h3><p className="pre" dir="auto">{i.actionTaken}</p></>}
            {i.resolution && <><h3>{t('incidents.resolution')}</h3><p className="pre" dir="auto">{i.resolution}</p></>}
            {urls.length > 0 && (
              <div className="thumbs big">
                {urls.map((u) => <button key={u} type="button" className="thumb" onClick={() => setBig(u)}><img src={u} alt="" /></button>)}
              </div>
            )}
          </>
        )}
        <div className="actions">
          {i && !i.closedAt && <button type="button" className="primary" onClick={() => setClosing(true)}>{t('incidents.close')}</button>}
          <button type="button" onClick={onClose} autoFocus>{t('common.close')}</button>
        </div>
      </div>
      {big && <div className="lightbox" onClick={() => setBig(null)}><img src={big} alt="" /></div>}
      {closing && (
        <PromptDialog title={t('incidents.closeTitle')} label={t('incidents.resolution')} confirmLabel={t('incidents.close')} multiline
          onClose={() => setClosing(false)}
          onConfirm={async (resolution) => {
            await window.api.incidents.close(id, resolution)
            toast(t('incidents.closeDone'))
            setClosing(false)
            load()
            onChanged?.()
          }} />
      )}
    </div>
  )
}

export default function IncidentsPage(): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [f, setF] = useState(EMPTY)
  const [occurredAt, setOccurredAt] = useState(localNow())
  const [photos, setPhotos] = useState<Uint8Array[]>([])
  const [open, setOpen] = useState<IncidentRow[]>([])
  const [detail, setDetail] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const lang = currentLang()

  const load = useCallback(() => {
    window.api.incidents.open().then(setOpen)
  }, [])
  useEffect(load, [load])

  const set = (k: keyof typeof EMPTY, v: string): void => setF((cur) => ({ ...cur, [k]: v }))

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    try {
      await window.api.incidents.add({ ...f, occurredAt: new Date(occurredAt).toISOString(), photos })
      toast(t('incidents.saved'))
      setF(EMPTY)
      setPhotos([])
      setOccurredAt(localNow())
      load()
    } catch (err) {
      toast(errorText(err, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="split-page">
      <form className="card" onSubmit={submit}>
        <h1>{t('incidents.titleNew')}</h1>
        <div className="row2">
          <label>{t('incidents.type')}
            <select value={f.type} onChange={(e) => set('type', e.target.value)}>
              {TYPES.map((x) => <option key={x} value={x}>{t(`incidentType.${x}`)}</option>)}
            </select>
          </label>
          <label>{t('incidents.occurredAt')}<input type="datetime-local" value={occurredAt} max={localNow()} onChange={(e) => setOccurredAt(e.target.value)} /></label>
        </div>
        <div className="seg" role="radiogroup" aria-label={t('incidents.severity')}>
          {SEVERITIES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={f.severity === s} className={`seg-btn sev-${s} ${f.severity === s ? 'on' : ''}`}
              onClick={() => set('severity', s)}>{t(`severity.${s}`)}</button>
          ))}
        </div>
        <label>{t('incidents.location')}<input value={f.location} onChange={(e) => set('location', e.target.value)} dir="auto" /></label>
        <label className="req">{t('incidents.description')}
          <textarea rows={4} value={f.description} onChange={(e) => set('description', e.target.value)} dir="auto" autoFocus />
        </label>
        <div className="row2">
          <label>{t('incidents.people')}<textarea rows={2} value={f.peopleInvolved} onChange={(e) => set('peopleInvolved', e.target.value)} dir="auto" /></label>
          <label>{t('incidents.action')}<textarea rows={2} value={f.actionTaken} onChange={(e) => set('actionTaken', e.target.value)} dir="auto" /></label>
        </div>
        <h3>{t('incidents.photos')}</h3>
        <PhotoPicker photos={photos} onChange={setPhotos} max={MAX_PHOTOS} />
        <div className="actions">
          <button className="primary big" disabled={busy || !f.description.trim()}><Icon name="alert" /> {t('incidents.save')}</button>
        </div>
      </form>

      <section className="card">
        <div className="section-head">
          <h2>{t('incidents.openList')}</h2>
          <span className="count-pill">{open.length}</span>
        </div>
        {open.length === 0 ? <p className="empty">{t('incidents.none')}</p> : (
          <ul className="incident-list">
            {open.map((i) => (
              <li key={i.id}>
                <button type="button" className={`incident-item sev-${i.severity}`} onClick={() => setDetail(i.id)}>
                  <div className="incident-top">
                    <strong>{t(`incidentType.${i.type}`)}</strong>
                    <span className={`tag sev-${i.severity}`}>{t(`severity.${i.severity}`)}</span>
                    {i.photoCount > 0 && <span className="muted"><Icon name="camera" size={14} /> {i.photoCount}</span>}
                    <span className="muted end">{formatDateTime(i.occurredAt, lang)}</span>
                  </div>
                  <span className="clamp" dir="auto">{[i.location, i.description].filter(Boolean).join(' — ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {detail !== null && <IncidentDialog id={detail} onClose={() => setDetail(null)} onChanged={load} />}
    </div>
  )
}
