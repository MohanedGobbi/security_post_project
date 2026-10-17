import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateTime, LOCALE_TAG } from '@shared/i18n'
import { currentLang } from '@desktop/i18n'
import Icon from '@desktop/components/Icon'
import { errText, get, patch, post, preregQrUrl } from '../api'
import { useDash } from '../App'
import type { Prereg, Site } from '../types'

const isoDay = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function PassDialog({ p, onClose }: { p: Prereg; onClose(): void }): ReactNode {
  const { t } = useTranslation()
  const { toast } = useDash()
  const lang = currentLang()
  const day = (d: string): string => new Date(`${d}T12:00:00`).toLocaleDateString(LOCALE_TAG[lang], { weekday: 'long', day: 'numeric', month: 'long' })
  const when = p.validFrom === p.validTo ? day(p.validFrom) : `${day(p.validFrom)} → ${day(p.validTo)}`
  const message = t('dash.prereg.message', { name: p.fullName, site: p.siteName, when, host: p.host, code: p.refCode })
  const [qr, setQr] = useState<string | null>(null)
  useEffect(() => {
    let url: string | null = null
    preregQrUrl(p.id).then((u) => { url = u; setQr(u) }).catch(() => setQr(null))
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [p.id])

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(message)
    toast(t('dash.prereg.copied'))
  }

  return (
    <div className="modal" role="dialog" aria-modal onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="card modal-card pass-card">
        <div className="pass printable">
          <div className="pass-band">{t('dash.prereg.pass')} · {p.siteName}</div>
          {qr ? <img className="pass-qr" src={qr} alt={`QR ${p.refCode}`} /> : <div className="pass-qr" />}
          <div className="pass-code mono">{p.refCode}</div>
          <strong className="pass-name" dir="auto">{p.fullName}</strong>
          {p.company && <span dir="auto">{p.company}</span>}
          <span>{when}</span>
          {p.host && <span>{t('badge.visiting')}: <b dir="auto">{p.host}</b></span>}
          <span className="muted small">{t('dash.prereg.passHint')}</span>
        </div>
        <label>{t('dash.prereg.messageLabel')}<textarea rows={4} readOnly value={message} dir="auto" /></label>
        <div className="actions">
          <button type="button" onClick={onClose}>{t('common.close')}</button>
          {qr && <a className="button" href={qr} download={`pass_${p.refCode}.svg`}>{t('dash.prereg.downloadQr')}</a>}
          <button type="button" onClick={copy}>{t('dash.prereg.copy')}</button>
          <button type="button" className="primary" onClick={() => window.print()}><Icon name="printer" /> {t('common.print')}</button>
        </div>
      </div>
    </div>
  )
}

export default function ExpectedPage(): ReactNode {
  const { t } = useTranslation()
  const { toast, me } = useDash()
  const lang = currentLang()
  const [sites, setSites] = useState<Site[]>([])
  const [list, setList] = useState<Prereg[]>([])
  const [pass, setPass] = useState<Prereg | null>(null)
  const empty = { siteId: 0, fullName: '', company: '', host: me.name, purpose: '', phone: '', email: '', validFrom: isoDay(new Date()), validTo: isoDay(new Date()), notes: '' }
  const [f, setF] = useState(empty)

  const load = useCallback(() => {
    get<Prereg[]>('/api/prereg').then(setList).catch((e) => toast(errText(e, t), 'error'))
  }, [t, toast])

  useEffect(() => {
    get<Site[]>('/api/sites').then((s) => {
      const active = s.filter((x) => x.active)
      setSites(active)
      if (active.length) setF((cur) => ({ ...cur, siteId: cur.siteId || active[0].id }))
    })
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [load])

  const set = (k: keyof typeof empty, v: string | number): void => setF((cur) => ({ ...cur, [k]: v }))

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    try {
      const r = await post<{ id: number; refCode: string }>('/api/prereg', f)
      toast(t('expected.added', { name: f.fullName }))
      setF({ ...empty, siteId: f.siteId })
      const fresh = await get<Prereg[]>('/api/prereg')
      setList(fresh)
      setPass(fresh.find((p) => p.id === r.id) ?? null)
    } catch (err) {
      toast(errText(err, t), 'error')
    }
  }

  const cancel = async (p: Prereg): Promise<void> => {
    try {
      await patch(`/api/prereg/${p.id}`, { status: 'cancelled' })
      load()
    } catch (err) {
      toast(errText(err, t), 'error')
    }
  }

  const day = (d: string): string => new Date(`${d}T12:00:00`).toLocaleDateString(LOCALE_TAG[lang], { day: 'numeric', month: 'short' })

  return (
    <div className="split-page">
      <section className="card">
        <h1>{t('dash.nav.expected')}</h1>
        {list.length === 0 ? <p className="empty">{t('expected.noneToday')}</p> : (
          <ul className="inside-list">
            {list.map((p) => (
              <li key={p.id} className={`expected-row ${p.status}`}>
                <div className="who-col">
                  <strong dir="auto">{p.fullName}</strong>
                  <span className="muted" dir="auto">{[p.company, p.host && `→ ${p.host}`, p.siteName].filter(Boolean).join(' · ')}</span>
                </div>
                <div className="meta-col">
                  <span>{p.validFrom === p.validTo ? day(p.validFrom) : `${day(p.validFrom)} → ${day(p.validTo)}`}</span>
                  <span className={`tag ${p.status === 'arrived' ? 'inside' : p.status === 'cancelled' ? 'sev-high' : 'waiting'}`}>
                    {t(`dash.prereg.status.${p.status}`)}{p.arrivedAt && ` ${formatDateTime(p.arrivedAt, lang)}`}
                  </span>
                </div>
                <div className="row-actions">
                  <button type="button" onClick={() => setPass(p)}>{t('dash.prereg.showPass')}</button>
                  {p.status === 'pending' && <button type="button" onClick={() => cancel(p)}>{t('expected.cancel')}</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="card" onSubmit={submit}>
        <h2>{t('dash.prereg.new')}</h2>
        <p className="hint">{t('dash.prereg.intro')}</p>
        {sites.length > 1 && (
          <label>{t('dash.site')}
            <select value={f.siteId} onChange={(e) => set('siteId', Number(e.target.value))}>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <label className="req">{t('visitor.fullName')}<input value={f.fullName} onChange={(e) => set('fullName', e.target.value)} dir="auto" required /></label>
        <div className="row2">
          <label>{t('visitor.company')}<input value={f.company} onChange={(e) => set('company', e.target.value)} dir="auto" /></label>
          <label>{t('visitor.host')}<input value={f.host} onChange={(e) => set('host', e.target.value)} dir="auto" /></label>
        </div>
        <label>{t('visitor.purpose')}<input value={f.purpose} onChange={(e) => set('purpose', e.target.value)} dir="auto" /></label>
        <div className="row2">
          <label>{t('visitor.phone')}<input value={f.phone} onChange={(e) => set('phone', e.target.value)} dir="ltr" inputMode="tel" /></label>
          <label>{t('dash.user.email')}<input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} dir="ltr" /></label>
        </div>
        <div className="row2">
          <label>{t('expected.from')}<input type="date" value={f.validFrom} onChange={(e) => setF({ ...f, validFrom: e.target.value, validTo: e.target.value > f.validTo ? e.target.value : f.validTo })} /></label>
          <label>{t('expected.to')}<input type="date" value={f.validTo} min={f.validFrom} onChange={(e) => set('validTo', e.target.value)} /></label>
        </div>
        <label>{t('visitor.notes')}<input value={f.notes} onChange={(e) => set('notes', e.target.value)} dir="auto" /></label>
        <div className="actions"><button className="primary" disabled={!f.fullName.trim() || !f.siteId}>{t('dash.prereg.create')}</button></div>
      </form>
      {pass && <PassDialog p={pass} onClose={() => setPass(null)} />}
    </div>
  )
}
