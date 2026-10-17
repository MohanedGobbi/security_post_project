import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CustomField, CustomValues, DeliveryRow } from '@shared/types'
import { formatDuration, formatTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import PhotoPicker from '../components/PhotoPicker'
import PromptDialog from '../components/PromptDialog'
import Icon from '../components/Icon'
import { CustomFieldInputs, missingRequired, useCustomFields } from '../components/CustomFields'
import { errorText } from '../util'

const EMPTY = { carrier: '', courierName: '', recipient: '', parcels: '1', tracking: '', notes: '' }

export default function DeliveriesPage(): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [f, setF] = useState(EMPTY)
  const [photos, setPhotos] = useState<Uint8Array[]>([])
  const [more, setMore] = useState(false)
  const [waiting, setWaiting] = useState<DeliveryRow[]>([])
  const [recipients, setRecipients] = useState<string[]>([])
  const [handing, setHanding] = useState<DeliveryRow | null>(null)
  const [busy, setBusy] = useState(false)
  const customFields = useCustomFields('delivery')
  const [custom, setCustom] = useState<CustomValues>({})
  const [missing, setMissing] = useState<CustomField[]>([])
  const lang = currentLang()

  const load = useCallback(() => {
    window.api.deliveries.waiting().then(setWaiting)
    window.api.deliveries.recipients().then(setRecipients)
  }, [])
  useEffect(load, [load])

  const set = (k: keyof typeof EMPTY, v: string): void => setF((cur) => ({ ...cur, [k]: v }))

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    const miss = missingRequired(customFields, custom)
    setMissing(miss)
    if (miss.length) return toast(t('error.customRequired'), 'error')
    setBusy(true)
    try {
      await window.api.deliveries.add({ ...f, parcels: Number(f.parcels) || 1, photo: photos[0] ?? null, custom })
      toast(t('deliveries.saved', { name: f.recipient }))
      setF(EMPTY)
      setPhotos([])
      setCustom({})
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
        <h1>{t('deliveries.titleNew')}</h1>
        <label className="req">{t('deliveries.recipient')}
          <input value={f.recipient} onChange={(e) => set('recipient', e.target.value)} dir="auto" autoFocus />
          {recipients.length > 0 && (
            <div className="chips">
              {recipients.map((r) => <button key={r} type="button" className={f.recipient === r ? 'chip on' : 'chip'} onClick={() => set('recipient', r)}>{r}</button>)}
            </div>
          )}
        </label>
        <div className="row3">
          <label>{t('deliveries.carrier')}<input value={f.carrier} onChange={(e) => set('carrier', e.target.value)} dir="auto" /></label>
          <label>{t('deliveries.courier')}<input value={f.courierName} onChange={(e) => set('courierName', e.target.value)} dir="auto" /></label>
          <label>{t('deliveries.parcels')}<input type="number" min={1} max={999} value={f.parcels} onChange={(e) => set('parcels', e.target.value)} /></label>
        </div>
        <CustomFieldInputs fields={customFields} values={custom} onChange={setCustom} only="required" missing={missing} />
        <button type="button" className="link more-toggle" onClick={() => setMore(!more)} aria-expanded={more}>
          {more ? '▾' : '▸'} {t(more ? 'common.lessDetails' : 'common.moreDetails')}
        </button>
        {more && (
          <div className="more">
            <label>{t('deliveries.tracking')}<input value={f.tracking} onChange={(e) => set('tracking', e.target.value)} dir="ltr" /></label>
            <label>{t('visitor.notes')}<textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} dir="auto" /></label>
            <CustomFieldInputs fields={customFields} values={custom} onChange={setCustom} only="optional" />
            <PhotoPicker photos={photos} onChange={setPhotos} max={1} />
          </div>
        )}
        <div className="actions">
          <button className="primary big" disabled={busy || !f.recipient.trim()}><Icon name="box" /> {t('deliveries.save')}</button>
        </div>
      </form>

      <section className="card">
        <div className="section-head">
          <h2>{t('deliveries.waiting')}</h2>
          <span className="count-pill">{waiting.reduce((n, d) => n + d.parcels, 0)}</span>
        </div>
        {waiting.length === 0 ? <p className="empty">{t('deliveries.none')}</p> : (
          <ul className="inside-list">
            {waiting.map((d) => (
              <li key={d.id}>
                <div className="who-col">
                  <strong dir="auto">{d.recipient}</strong>
                  <span className="muted">{[d.carrier, d.tracking].filter(Boolean).join(' · ')}</span>
                </div>
                <div className="meta-col">
                  <span className="badge-chip">× {d.parcels}</span>
                  <span>{formatTime(d.time, lang)}</span>
                  <span className="muted">{t('deliveries.waitingSince', { time: formatDuration(d.time, null, lang) })}</span>
                </div>
                <button type="button" className="exit-btn" onClick={() => setHanding(d)}>{t('deliveries.pickUp')}</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {handing && (
        <PromptDialog
          title={t('deliveries.pickUpTitle')}
          summary={<><strong dir="auto">{handing.recipient}</strong><span className="muted">{handing.carrier} × {handing.parcels}</span></>}
          label={t('deliveries.pickUpWho')}
          confirmLabel={t('deliveries.pickUp')}
          required
          onClose={() => setHanding(null)}
          onConfirm={async (by) => {
            await window.api.deliveries.pickUp(handing.id, by)
            toast(t('deliveries.pickUpDone', { name: by }))
            setHanding(null)
            load()
          }}
        />
      )}
    </div>
  )
}
