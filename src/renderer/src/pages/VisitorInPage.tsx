import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_CARD_PICTURES, type CustomField, type CustomValues, type ExpectedVisitor, type IdType, type PersonFields, type PersonLookup, type ScanResult, type WatchHit } from '@shared/types'
import { QR_BADGE, QR_PREREG } from '@shared/sync'
import { formatDateTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import CameraPanel from '../components/CameraPanel'
import { CardPictures } from '../components/CardPictures'
import Icon from '../components/Icon'
import WatchAlert, { isBlocking } from '../components/WatchAlert'
import { openExpectedByCode } from './ExpectedPage'
import { CustomFieldInputs, missingRequired, useCustomFields } from '../components/CustomFields'
import { bytesToUrl, errorText, todayStr } from '../util'

const ID_TYPES: IdType[] = ['national_id', 'passport', 'residence', 'driver_license', 'student', 'employee', 'other']

const EMPTY = {
  fullName: '', fullNameAlt: '', idType: 'national_id' as IdType, idNumber: '', nationality: '', birthDate: '',
  sex: '', phone: '', company: '', host: '', purpose: '', badgeNo: '', vehiclePlate: '', notes: ''
}
type Form = typeof EMPTY
type TextField = Exclude<keyof Form, 'idType'>
const EXTRA_FIELDS: TextField[] = ['fullNameAlt', 'nationality', 'birthDate', 'sex', 'phone', 'company', 'vehiclePlate', 'notes']

const normId = (s: string): string => s.toUpperCase().replace(/[\s\-.<\/]/g, '')

interface Status { kind: 'ok' | 'warn' | 'error'; text: string }

export default function VisitorInPage(): ReactNode {
  const { t } = useTranslation()
  const { go, toast, features, takeExpected } = useApp()
  const [expected, setExpected] = useState<ExpectedVisitor | null>(null)
  const [picking, setPicking] = useState(false)
  const useCamera = features.idScan || features.visitorPhoto
  const [f, setF] = useState<Form>(EMPTY)
  const [more, setMore] = useState(false)
  const [photo, setPhoto] = useState<Uint8Array | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [returning, setReturning] = useState<PersonLookup | null>(null)
  const [lines, setLines] = useState<string[]>([])
  /** pictures of the ID card taken by the scanner: saved with the entry */
  const [cards, setCards] = useState<Uint8Array[]>([])
  const [barcodes, setBarcodes] = useState<string[]>([])
  const [suggest, setSuggest] = useState<{ hosts: string[]; purposes: string[] }>({ hosts: [], purposes: [] })
  const [busy, setBusy] = useState(false)
  const lastField = useRef<TextField>('fullName')
  const lookedUp = useRef('')
  const [hits, setHits] = useState<WatchHit[]>([])
  const [alertOpen, setAlertOpen] = useState(false)
  const [needPin, setNeedPin] = useState(false)
  const shownHits = useRef('')
  const customFields = useCustomFields('visit')
  const [custom, setCustom] = useState<CustomValues>({})
  const [missing, setMissing] = useState<CustomField[]>([])
  const lang = currentLang()

  useEffect(() => {
    window.api.visits.suggestions().then(setSuggest)
    // arriving from the Expected visitors page
    const e = takeExpected()
    if (e) applyExpected(e)
  }, [])

  const photoUrl = useMemo(() => bytesToUrl(photo), [photo])
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])

  const set = (k: keyof Form, v: string): void => setF((cur) => ({ ...cur, [k]: v }))
  const bind = (k: TextField) => ({
    value: f[k],
    onChange: (e: { target: { value: string } }) => set(k, e.target.value),
    onFocus: () => { lastField.current = k }
  })

  // returning visitor: look the ID up shortly after it is typed or scanned
  useEffect(() => {
    const id = normId(f.idNumber)
    if (id.length < 4 || id === lookedUp.current) return
    const timer = setTimeout(async () => {
      lookedUp.current = id
      const p = await window.api.visits.lookup(id)
      setReturning(p)
      if (!p) return
      setF((cur) => {
        const next = { ...cur }
        for (const k of Object.keys(p.fields) as (keyof PersonFields)[]) {
          if (k === 'idType') continue
          if (!String(next[k]).trim() && p.fields[k]) (next as Record<string, string>)[k] = p.fields[k]
        }
        if (!next.host) next.host = p.lastHost
        if (!next.purpose) next.purpose = p.lastPurpose
        return next
      })
    }, 450)
    return () => clearTimeout(timer)
  }, [f.idNumber])

  // watchlist: checked on the ID number, the name and the plate as they are scanned / typed
  useEffect(() => {
    const q = { idNumber: normId(f.idNumber), name: f.fullName, plate: f.vehiclePlate }
    if (q.idNumber.length < 4 && !q.name.trim().includes(' ') && q.plate.length < 3) { setHits([]); return }
    const timer = setTimeout(async () => {
      const w = await window.api.watchlist.check(q)
      // pop the alert once per new set of matches
      const ids = w.map((h) => h.id).join()
      if (w.length && ids !== shownHits.current) setAlertOpen(true)
      shownHits.current = ids
      setHits(w)
    }, 450)
    return () => clearTimeout(timer)
  }, [f.idNumber, f.fullName, f.vehiclePlate])

  /** Pre-registration: fill what the host already gave, the guard completes with the ID card */
  function applyExpected(e: ExpectedVisitor): void {
    setExpected(e)
    setPicking(false)
    setF((cur) => ({
      ...cur,
      fullName: cur.fullName || e.fullName, company: cur.company || e.company, host: e.host || cur.host,
      purpose: e.purpose || cur.purpose, phone: cur.phone || e.phone
    }))
  }

  const applyScan = (r: ScanResult): void => {
    // the visitor showed their pass (QR received at invitation) instead of an ID card
    const pass = r.barcodes.find((b) => b.text.startsWith(QR_PREREG))
    if (pass) {
      void openExpectedByCode(pass.text, applyExpected, (key) => setStatus({ kind: 'error', text: t(key) }))
      return
    }
    if (r.barcodes.some((b) => b.text.startsWith(QR_BADGE))) {
      setStatus({ kind: 'warn', text: t('badge.isBadge') })
      return
    }
    setBarcodes(r.source === 'none' ? r.barcodes.map((b) => b.text) : [])
    setLines(r.lines)
    if (r.source === 'none') {
      setStatus({ kind: 'error', text: t('visitor.scanFailed') })
      return
    }
    setF((cur) => {
      const next = { ...cur }
      for (const [k, v] of Object.entries(r.fields)) if (v) (next as Record<string, string>)[k] = v
      return next
    })
    if (r.fields.nationality || r.fields.birthDate || r.fields.sex) setMore(true)
    if (r.source === 'ocr') setStatus({ kind: 'warn', text: t('visitor.scanOkText') })
    else if (!r.valid) setStatus({ kind: 'warn', text: t('visitor.scanCheckWarn') })
    else setStatus({ kind: 'ok', text: t(r.source === 'mrz' ? 'visitor.scanOkMrz' : 'visitor.scanOkBarcode') })
  }

  const pickLine = (text: string): void => {
    const k = lastField.current
    set(k, text)
    if (EXTRA_FIELDS.includes(k)) setMore(true)
    document.getElementById(`f-${k}`)?.focus()
  }

  const save = async (supervisorPin?: string): Promise<void> => {
    setBusy(true)
    try {
      const visitId = await window.api.visits.checkIn({ ...f, photo, cards, supervisorPin, custom, expectedId: expected?.id ?? null })
      if (features.modules.badges) {
        const b = await window.api.badges.settings()
        if (b.autoPrint) window.api.badges.print(visitId).catch((err) => toast(errorText(err, t), 'error'))
      }
      toast(t('visitor.saved', { name: f.fullName }))
      go('home')
    } catch (err) {
      if (String(err).includes('error.watchlistDeny')) setNeedPin(true)
      setStatus({ kind: 'error', text: errorText(err, t) })
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!f.fullName.trim()) return setStatus({ kind: 'error', text: t('error.nameRequired') })
    if (features.requireIdNumber && !normId(f.idNumber)) return setStatus({ kind: 'error', text: t('error.idRequired') })
    const miss = missingRequired(customFields, custom)
    setMissing(miss)
    if (miss.length) return setStatus({ kind: 'error', text: t('error.customRequired') })
    // a "deny" match needs a supervisor PIN before the entry is recorded
    if (isBlocking(hits)) return setNeedPin(true)
    save()
  }

  const chips = (values: string[], k: TextField): ReactNode =>
    values.length > 0 && (
      <div className="chips">
        {values.map((v) => <button key={v} type="button" className={f[k] === v ? 'chip on' : 'chip'} onClick={() => set(k, v)}>{v}</button>)}
      </div>
    )

  return (
    <div className={`visitor-in ${useCamera ? '' : 'solo'}`}>
      {useCamera && (
      <section className="card">
        <CameraPanel
          onScan={applyScan}
          onCard={(jpeg) => setCards((cur) => [...cur, jpeg].slice(-MAX_CARD_PICTURES))}
          onPhoto={setPhoto}
          onTextLines={(ls) => { setLines(ls); setStatus(null) }}
          onError={(m) => setStatus({ kind: 'error', text: errorText(m, t) })}
          hasPhoto={!!photo}
          scan={features.idScan}
          photo={features.visitorPhoto}
        />
        <CardPictures cards={cards} onRemove={(i) => setCards((cur) => cur.filter((_, k) => k !== i))} />
        {(lines.length > 0 || barcodes.length > 0) && (
          <div className="ocr-lines">
            <p className="hint">{t(lines.length ? 'visitor.textHint' : 'visitor.barcodeHint')}</p>
            <div className="chips">
              {[...barcodes, ...lines].map((l, i) => <button key={i} type="button" className="chip line" dir="auto" onClick={() => pickLine(l)}>{l}</button>)}
            </div>
          </div>
        )}
      </section>
      )}

      <form className="card visitor-form" onSubmit={submit}>
        <div className="form-head">
          <h1>{t('visitor.titleIn')}</h1>
          {features.modules.preregistration && (
            <button type="button" onClick={() => setPicking(true)}><Icon name="calendar" /> {t('expected.pick')}</button>
          )}
          {photoUrl && <img className="visitor-photo" src={photoUrl} alt={t('visitor.photo')} />}
        </div>

        {hits.length > 0 && (
          <button type="button" className={`banner ${isBlocking(hits) ? 'error' : 'warn'} as-button`} onClick={() => setAlertOpen(true)}>
            <Icon name="alert" /> {t(isBlocking(hits) ? 'watch.denyTitle' : 'watch.alertTitle')}: {hits[0].reason}
          </button>
        )}
        {expected && (
          <div className="banner info"><Icon name="calendar" /> {t('expected.filling', { ref: expected.refCode })}
            <button type="button" className="link" onClick={() => setExpected(null)}>{t('common.cancel')}</button></div>
        )}
        {status && <div className={`banner ${status.kind}`}>{status.text}</div>}
        {returning && (
          <div className={`banner ${returning.insideVisitId ? 'error' : 'info'}`}>
            {returning.insideVisitId ? (
              <>
                <Icon name="alert" /> {t('visitor.alreadyInside')}{' '}
                <button type="button" className="link" onClick={() => go('out')}>{t('nav.visitorOut')}</button>
              </>
            ) : (
              <><Icon name="user" /> {t('visitor.returning', { count: returning.visitsCount, date: formatDateTime(returning.lastSeen, lang) })}</>
            )}
          </div>
        )}

        <label className="req">{t('visitor.fullName')}<input id="f-fullName" {...bind('fullName')} dir="auto" autoFocus /></label>
        <div className="row2">
          <label>{t('visitor.idType')}
            <select value={f.idType} onChange={(e) => set('idType', e.target.value)}>
              {ID_TYPES.map((x) => <option key={x} value={x}>{t(`idType.${x}`)}</option>)}
            </select>
          </label>
          <label className={features.requireIdNumber ? 'req' : ''}>{t('visitor.idNumber')}<input id="f-idNumber" {...bind('idNumber')} dir="ltr" className="mono" /></label>
        </div>
        <label>{t('visitor.host')}<input id="f-host" {...bind('host')} dir="auto" />{chips(suggest.hosts, 'host')}</label>
        <div className={features.badgeNumbers ? 'row2' : ''}>
          <label>{t('visitor.purpose')}<input id="f-purpose" {...bind('purpose')} dir="auto" /></label>
          {features.badgeNumbers && <label>{t('visitor.badgeNo')}<input id="f-badgeNo" {...bind('badgeNo')} dir="ltr" /></label>}
        </div>
        {chips(suggest.purposes, 'purpose')}
        <CustomFieldInputs fields={customFields} values={custom} onChange={setCustom} only="required" missing={missing} />

        <button type="button" className="link more-toggle" onClick={() => setMore(!more)} aria-expanded={more}>
          {more ? '▾' : '▸'} {t(more ? 'common.lessDetails' : 'common.moreDetails')}
        </button>
        {more && (
          <div className="more">
            <label>{t('visitor.fullNameAlt')}<input id="f-fullNameAlt" {...bind('fullNameAlt')} dir="auto" /></label>
            <div className="row3">
              <label>{t('visitor.nationality')}<input id="f-nationality" {...bind('nationality')} /></label>
              <label>{t('visitor.birthDate')}<input id="f-birthDate" type="date" {...bind('birthDate')} /></label>
              <label>{t('visitor.sex')}
                <select value={f.sex} onChange={(e) => set('sex', e.target.value)}>
                  <option value="">–</option>
                  <option value="M">{t('visitor.sexM')}</option>
                  <option value="F">{t('visitor.sexF')}</option>
                </select>
              </label>
            </div>
            <div className="row3">
              <label>{t('visitor.company')}<input id="f-company" {...bind('company')} dir="auto" /></label>
              <label>{t('visitor.phone')}<input id="f-phone" {...bind('phone')} dir="ltr" inputMode="tel" /></label>
              <label>{t('visitor.vehiclePlate')}<input id="f-vehiclePlate" {...bind('vehiclePlate')} dir="ltr" /></label>
            </div>
            <label>{t('visitor.notes')}<textarea id="f-notes" rows={2} {...bind('notes')} dir="auto" /></label>
            <CustomFieldInputs fields={customFields} values={custom} onChange={setCustom} only="optional" />
          </div>
        )}

        <div className="actions sticky">
          <button type="button" onClick={() => go('home')}>{t('common.cancel')}</button>
          <button className="primary big" disabled={busy}><Icon name="enter" /> {t('visitor.save')}</button>
        </div>
      </form>
      {(alertOpen || needPin) && hits.length > 0 && (
        <WatchAlert hits={hits} onClose={() => { setAlertOpen(false); setNeedPin(false) }}
          onOverride={needPin ? (pin) => { setNeedPin(false); setAlertOpen(false); save(pin) } : undefined} />
      )}
      {picking && <ExpectedPicker onPick={applyExpected} onClose={() => setPicking(false)} />}
    </div>
  )
}

/** Today's expected visitors, to pick the one standing at the desk */
function ExpectedPicker({ onPick, onClose }: { onPick(e: ExpectedVisitor): void; onClose(): void }): ReactNode {
  const { t } = useTranslation()
  const [list, setList] = useState<ExpectedVisitor[]>([])
  const [q, setQ] = useState('')
  useEffect(() => {
    const today = todayStr()
    window.api.expected.list().then((all) => setList(all.filter((e) => e.status === 'pending' && e.validFrom <= today)))
  }, [])
  const n = q.trim().toLowerCase()
  const shown = list.filter((e) => !n || `${e.fullName} ${e.company} ${e.host} ${e.refCode}`.toLowerCase().includes(n))
  return (
    <div className="modal" role="dialog" aria-modal onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="card modal-card">
        <h2>{t('expected.today')}</h2>
        <input className="search-big" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('expected.filter')} dir="auto" autoFocus />
        {shown.length === 0 ? <p className="empty">{t('expected.noneToday')}</p> : (
          <ul className="pick-list">
            {shown.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onPick(e)}>
                  <strong dir="auto">{e.fullName}</strong>
                  <span className="muted" dir="auto">{[e.company, e.host && `→ ${e.host}`].filter(Boolean).join(' ')}</span>
                  <span className="mono ref">{e.refCode}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="actions"><button type="button" onClick={onClose}>{t('common.close')}</button></div>
      </div>
    </div>
  )
}
