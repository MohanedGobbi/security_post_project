import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CustomField, CustomValues, VehicleLookup, VehicleRow, VehicleType, WatchHit } from '@shared/types'
import { formatDateTime, formatDuration, formatTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import PhotoPicker from '../components/PhotoPicker'
import PromptDialog from '../components/PromptDialog'
import WatchAlert, { isBlocking } from '../components/WatchAlert'
import Icon from '../components/Icon'
import { CustomFieldInputs, missingRequired, useCustomFields } from '../components/CustomFields'
import { errorText } from '../util'

const TYPES: VehicleType[] = ['car', 'van', 'truck', 'motorcycle', 'bus', 'other']
const EMPTY = { plate: '', vehicleType: 'car' as VehicleType, color: '', driverName: '', company: '', passengers: '', cargo: '', notes: '' }
const normPlate = (p: string): string => p.toUpperCase().replace(/[\s\-.·]/g, '')

export default function VehiclesPage(): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [f, setF] = useState(EMPTY)
  const [more, setMore] = useState(false)
  const [photos, setPhotos] = useState<Uint8Array[]>([])
  const [known, setKnown] = useState<VehicleLookup | null>(null)
  const [hits, setHits] = useState<WatchHit[]>([])
  const [alertOpen, setAlertOpen] = useState(false)
  const [needPin, setNeedPin] = useState(false)
  const [inside, setInside] = useState<VehicleRow[]>([])
  const [leaving, setLeaving] = useState<VehicleRow | null>(null)
  const [busy, setBusy] = useState(false)
  const shownHits = useRef('')
  const customFields = useCustomFields('vehicle')
  const [custom, setCustom] = useState<CustomValues>({})
  const [missing, setMissing] = useState<CustomField[]>([])
  const lang = currentLang()

  const load = useCallback(() => {
    window.api.vehicles.inside().then(setInside)
  }, [])
  useEffect(load, [load])

  const set = (k: keyof typeof EMPTY, v: string): void => setF((cur) => ({ ...cur, [k]: v }))

  // known vehicle + watchlist, shortly after the plate is typed
  useEffect(() => {
    const p = normPlate(f.plate)
    if (p.length < 3) { setKnown(null); setHits([]); return }
    const timer = setTimeout(async () => {
      const [k, w] = await Promise.all([window.api.vehicles.lookup(p), window.api.watchlist.check({ plate: p, name: f.driverName })])
      setKnown(k)
      if (k?.last) {
        const last = k.last
        setF((cur) => ({
          ...cur,
          vehicleType: cur.vehicleType === 'car' ? last.vehicleType : cur.vehicleType,
          color: cur.color || last.color,
          driverName: cur.driverName || last.driverName,
          company: cur.company || last.company
        }))
      }
      // pop the alert once per new set of matches
      const ids = w.map((h) => h.id).join()
      if (w.length && ids !== shownHits.current) setAlertOpen(true)
      shownHits.current = ids
      setHits(w)
    }, 450)
    return () => clearTimeout(timer)
  }, [f.plate, f.driverName])

  const save = async (supervisorPin?: string): Promise<void> => {
    setBusy(true)
    try {
      await window.api.vehicles.checkIn({ ...f, passengers: Number(f.passengers) || 0, photo: photos[0] ?? null, supervisorPin, custom })
      toast(t('vehicles.saved', { plate: f.plate.toUpperCase() }))
      setF(EMPTY)
      setPhotos([])
      setCustom({})
      setKnown(null)
      setHits([])
      setNeedPin(false)
      load()
    } catch (err) {
      const msg = errorText(err, t)
      if (String(err).includes('error.watchlistDeny')) setNeedPin(true)
      toast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const miss = missingRequired(customFields, custom)
    setMissing(miss)
    if (miss.length) return toast(t('error.customRequired'), 'error')
    if (isBlocking(hits)) setNeedPin(true)
    else save()
  }

  return (
    <div className="split-page">
      <form className="card" onSubmit={submit}>
        <h1>{t('vehicles.titleIn')}</h1>
        {hits.length > 0 && (
          <button type="button" className={`banner ${isBlocking(hits) ? 'error' : 'warn'} as-button`} onClick={() => setAlertOpen(true)}>
            <Icon name="alert" /> {t(isBlocking(hits) ? 'watch.denyTitle' : 'watch.alertTitle')}: {hits[0].reason}
          </button>
        )}
        {known && (
          <div className={`banner ${known.insideId ? 'error' : 'info'}`}>
            {known.insideId ? t('vehicles.alreadyInside') : t('vehicles.returning', { count: known.visits, date: formatDateTime(known.lastSeen, lang) })}
          </div>
        )}
        <div className="row2">
          <label className="req">{t('vehicles.plate')}
            <input className="plate-input" value={f.plate} onChange={(e) => set('plate', e.target.value)} dir="ltr" autoFocus />
          </label>
          <label>{t('vehicles.driver')}<input value={f.driverName} onChange={(e) => set('driverName', e.target.value)} dir="auto" /></label>
        </div>
        <div className="seg" role="radiogroup" aria-label={t('vehicles.type')}>
          {TYPES.map((x) => (
            <button key={x} type="button" role="radio" aria-checked={f.vehicleType === x} className={`seg-btn ${f.vehicleType === x ? 'on' : ''}`}
              onClick={() => set('vehicleType', x)}>{t(`vehicleType.${x}`)}</button>
          ))}
        </div>
        <div className="row3">
          <label>{t('vehicles.color')}<input value={f.color} onChange={(e) => set('color', e.target.value)} dir="auto" /></label>
          <label>{t('visitor.company')}<input value={f.company} onChange={(e) => set('company', e.target.value)} dir="auto" /></label>
          <label>{t('vehicles.passengers')}<input type="number" min={0} max={99} value={f.passengers} onChange={(e) => set('passengers', e.target.value)} /></label>
        </div>
        <CustomFieldInputs fields={customFields} values={custom} onChange={setCustom} only="required" missing={missing} />
        <button type="button" className="link more-toggle" onClick={() => setMore(!more)} aria-expanded={more}>
          {more ? '▾' : '▸'} {t(more ? 'common.lessDetails' : 'common.moreDetails')}
        </button>
        {more && (
          <div className="more">
            <label>{t('vehicles.cargo')}<input value={f.cargo} onChange={(e) => set('cargo', e.target.value)} dir="auto" /></label>
            <label>{t('visitor.notes')}<textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} dir="auto" /></label>
            <CustomFieldInputs fields={customFields} values={custom} onChange={setCustom} only="optional" />
            <PhotoPicker photos={photos} onChange={setPhotos} max={1} />
          </div>
        )}
        <div className="actions">
          <button className="primary big" disabled={busy || !normPlate(f.plate)}><Icon name="car" /> {t('vehicles.save')}</button>
        </div>
      </form>

      <section className="card">
        <div className="section-head">
          <h2>{t('vehicles.inside')}</h2>
          <span className="count-pill">{inside.length}</span>
        </div>
        {inside.length === 0 ? <p className="empty">{t('vehicles.none')}</p> : (
          <ul className="inside-list">
            {inside.map((v) => (
              <li key={v.id}>
                <div className="who-col">
                  <span><span className="plate big">{v.plate}</span> <span className="muted">{t(`vehicleType.${v.vehicleType}`)}{v.color && ` · ${v.color}`}</span></span>
                  <span className="muted">{[v.driverName, v.company].filter(Boolean).join(' · ')}{v.visitId ? ` · ${t('vehicles.linkedVisitor')}` : ''}</span>
                </div>
                <div className="meta-col">
                  <span>{t('home.since', { time: formatTime(v.timeIn, lang) })}</span>
                  <span className="muted">{formatDuration(v.timeIn, null, lang)}</span>
                </div>
                <button type="button" className="exit-btn" onClick={() => setLeaving(v)}>{t('vehicles.out')}</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {leaving && (
        <PromptDialog
          title={t('vehicles.out')}
          summary={<><span className="plate big">{leaving.plate}</span><span className="muted">{leaving.driverName}</span></>}
          label={t('vehicles.exitNote')}
          confirmLabel={t('checkout.confirm')}
          onClose={() => setLeaving(null)}
          onConfirm={async (note) => {
            await window.api.vehicles.checkOut(leaving.id, note)
            toast(t('vehicles.outDone', { plate: leaving.plate }))
            setLeaving(null)
            load()
          }}
        />
      )}
      {(alertOpen || needPin) && hits.length > 0 && (
        <WatchAlert hits={hits} onClose={() => { setAlertOpen(false); setNeedPin(false) }}
          onOverride={needPin ? (pin) => { setAlertOpen(false); save(pin) } : undefined} />
      )}
    </div>
  )
}
