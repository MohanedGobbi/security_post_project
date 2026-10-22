import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { VisitRow } from '@shared/types'
import { QR_BADGE } from '@shared/qr'
import { useApp } from '../App'
import InsideList from '../components/InsideList'
import CheckOutDialog from '../components/CheckOutDialog'
import QrScanner from '../components/QrScanner'
import Icon from '../components/Icon'

const norm = (s: string): string => s.toLowerCase().replace(/[\s\-.]/g, '')

export default function CheckOutPage(): ReactNode {
  const { t } = useTranslation()
  const { features, toast, refreshAlerts } = useApp()
  const [rows, setRows] = useState<VisitRow[]>([])
  const [q, setQ] = useState('')
  const [scanning, setScanning] = useState(false)
  const [leaving, setLeaving] = useState<VisitRow | null>(null)

  const load = useCallback(() => {
    window.api.visits.insideNow().then(setRows)
  }, [])
  useEffect(load, [load])

  const filtered = useMemo(() => {
    const n = norm(q)
    if (!n) return rows
    return rows.filter((v) =>
      [v.fullName, v.fullNameAlt, v.badgeNo, v.vehiclePlate, v.idNumber, v.company, v.host].some((x) => norm(x).includes(n)))
  }, [rows, q])

  /** The QR printed on the visitor badge identifies the visit */
  const onBadge = (text: string): void => {
    if (!text.startsWith(QR_BADGE)) return toast(t('badge.notBadge'), 'error')
    const v = rows.find((r) => r.id === Number(text.slice(QR_BADGE.length)))
    if (!v) return toast(t('badge.notInside'), 'error')
    setScanning(false)
    setLeaving(v)
  }

  return (
    <section className="card page-card">
      <div className="section-head">
        <h1>{t('checkout.title')}</h1>
        <div className="actions">
          {features.modules.badges && (
            <button type="button" onClick={() => setScanning(!scanning)}><Icon name="scan" /> {t('badge.scan')}</button>
          )}
          <span className="count-pill">{rows.length}</span>
        </div>
      </div>
      {scanning && <QrScanner onCode={onBadge} onClose={() => setScanning(false)} hint={t('badge.scanHint')} prefix={QR_BADGE} />}
      <input className="search-big" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('checkout.filter')} autoFocus dir="auto" />
      <InsideList rows={filtered} onChanged={load} emptyText={q ? t('checkout.none') : t('home.nobodyInside')} />
      {leaving && (
        <CheckOutDialog visit={leaving} onClose={() => setLeaving(null)} onDone={() => { setLeaving(null); load(); refreshAlerts() }} />
      )}
    </section>
  )
}
