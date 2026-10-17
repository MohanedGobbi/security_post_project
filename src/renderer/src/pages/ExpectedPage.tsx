import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExpectedVisitor } from '@shared/types'
import { QR_PREREG } from '@shared/sync'
import { formatDateTime, LOCALE_TAG } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import QrScanner from '../components/QrScanner'
import Icon from '../components/Icon'
import { errorText, todayStr } from '../util'

const EMPTY = { fullName: '', company: '', host: '', purpose: '', phone: '', validFrom: todayStr(), validTo: todayStr(), notes: '' }

/** Pass scanned at the desk, or a code typed by hand: open Visitor IN pre-filled */
export async function openExpectedByCode(text: string, onFound: (e: ExpectedVisitor) => void, onError: (key: string) => void): Promise<void> {
  const e = await window.api.expected.findByRef(text)
  if (!e) return onError('expected.notFound')
  if (e.status === 'cancelled') return onError('expected.cancelled')
  if (e.status === 'arrived') return onError('expected.alreadyArrived')
  const today = todayStr()
  if (e.validFrom > today || e.validTo < today) return onError('expected.notToday')
  onFound(e)
}

export default function ExpectedPage(): ReactNode {
  const { t } = useTranslation()
  const { toast, checkInExpected } = useApp()
  const [list, setList] = useState<ExpectedVisitor[]>([])
  const [f, setF] = useState(EMPTY)
  const [q, setQ] = useState('')
  const [scanning, setScanning] = useState(false)
  const lang = currentLang()
  const today = todayStr()

  const load = useCallback(() => {
    window.api.expected.list().then(setList)
  }, [])
  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [load])

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase()
    return list.filter((e) => !n || `${e.fullName} ${e.company} ${e.host} ${e.refCode}`.toLowerCase().includes(n))
  }, [list, q])
  const todays = filtered.filter((e) => e.validFrom <= today)
  const upcoming = filtered.filter((e) => e.validFrom > today)

  const day = (d: string): string => new Date(`${d}T12:00:00`).toLocaleDateString(LOCALE_TAG[lang], { weekday: 'short', day: 'numeric', month: 'short' })
  const set = (k: keyof typeof EMPTY, v: string): void => setF((cur) => ({ ...cur, [k]: v }))

  const add = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    try {
      await window.api.expected.add(f)
      toast(t('expected.added', { name: f.fullName }))
      setF({ ...EMPTY, validFrom: todayStr(), validTo: todayStr() })
      load()
    } catch (err) {
      toast(errorText(err, t), 'error')
    }
  }

  const cancel = async (id: number): Promise<void> => {
    try {
      await window.api.expected.cancel(id)
      load()
    } catch (err) {
      toast(errorText(err, t), 'error')
    }
  }

  const onCode = (text: string): void => {
    setScanning(false)
    void openExpectedByCode(text, checkInExpected, (key) => toast(t(key), 'error'))
  }

  const row = (e: ExpectedVisitor): ReactNode => (
    <li key={e.id} className={`expected-row ${e.status}`}>
      <div className="who-col">
        <strong dir="auto">{e.fullName}</strong>
        <span className="muted" dir="auto">{[e.company, e.host && `→ ${e.host}`, e.purpose].filter(Boolean).join(' · ')}</span>
        {e.notes && <span className="muted" dir="auto">{e.notes}</span>}
      </div>
      <div className="meta-col">
        <span className="mono ref">{e.refCode}</span>
        {e.validFrom !== e.validTo || e.validFrom !== today ? <span>{day(e.validFrom)}{e.validTo !== e.validFrom && ` → ${day(e.validTo)}`}</span> : null}
        <span className={`tag ${e.source === 'server' ? 'kind-shift_start' : ''}`}>{t(`expected.source.${e.source}`)}</span>
      </div>
      <div className="row-actions">
        {e.status === 'arrived' ? (
          <span className="tag inside">{t('expected.arrived')} {e.arrivedAt && formatDateTime(e.arrivedAt, lang)}</span>
        ) : (
          <>
            {e.validFrom <= today && <button type="button" className="primary" onClick={() => checkInExpected(e)}><Icon name="enter" /> {t('expected.checkIn')}</button>}
            {e.source === 'local' && <button type="button" onClick={() => cancel(e.id)}>{t('expected.cancel')}</button>}
          </>
        )}
      </div>
    </li>
  )

  return (
    <div className="split-page">
      <section className="card">
        <div className="section-head">
          <h1>{t('expected.title')}</h1>
          <button type="button" onClick={() => setScanning(!scanning)}><Icon name="scan" /> {t('expected.scanPass')}</button>
        </div>
        {scanning && <QrScanner onCode={onCode} onClose={() => setScanning(false)} hint={t('expected.scanHint')} prefix={QR_PREREG} />}
        <input className="search-big" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('expected.filter')} dir="auto"
          onKeyDown={(e) => { if (e.key === 'Enter' && /^[A-Z2-9]{6}$/i.test(q.trim())) onCode(q.trim()) }} />
        <h2>{t('expected.today')} <span className="count-pill">{todays.filter((e) => e.status === 'pending').length}</span></h2>
        {todays.length === 0 ? <p className="empty">{t('expected.noneToday')}</p> : <ul className="inside-list">{todays.map(row)}</ul>}
        {upcoming.length > 0 && (
          <>
            <h2 className="spaced">{t('expected.upcoming')}</h2>
            <ul className="inside-list">{upcoming.map(row)}</ul>
          </>
        )}
      </section>

      <form className="card" onSubmit={add}>
        <h2>{t('expected.add')}</h2>
        <p className="hint">{t('expected.addHint')}</p>
        <label className="req">{t('visitor.fullName')}<input value={f.fullName} onChange={(e) => set('fullName', e.target.value)} dir="auto" /></label>
        <div className="row2">
          <label>{t('visitor.company')}<input value={f.company} onChange={(e) => set('company', e.target.value)} dir="auto" /></label>
          <label>{t('visitor.host')}<input value={f.host} onChange={(e) => set('host', e.target.value)} dir="auto" /></label>
        </div>
        <div className="row2">
          <label>{t('visitor.purpose')}<input value={f.purpose} onChange={(e) => set('purpose', e.target.value)} dir="auto" /></label>
          <label>{t('visitor.phone')}<input value={f.phone} onChange={(e) => set('phone', e.target.value)} dir="ltr" inputMode="tel" /></label>
        </div>
        <div className="row2">
          <label>{t('expected.from')}<input type="date" value={f.validFrom} min={today} onChange={(e) => setF({ ...f, validFrom: e.target.value, validTo: e.target.value > f.validTo ? e.target.value : f.validTo })} /></label>
          <label>{t('expected.to')}<input type="date" value={f.validTo} min={f.validFrom} onChange={(e) => set('validTo', e.target.value)} /></label>
        </div>
        <label>{t('visitor.notes')}<input value={f.notes} onChange={(e) => set('notes', e.target.value)} dir="auto" /></label>
        <div className="actions"><button className="primary" disabled={!f.fullName.trim()}>{t('expected.add')}</button></div>
      </form>
    </div>
  )
}
