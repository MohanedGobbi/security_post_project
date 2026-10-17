import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { VisitRow } from '@shared/types'
import { formatDuration, formatTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import { errorText } from '../util'

export default function CheckOutDialog({ visit, onClose, onDone }: { visit: VisitRow; onClose(): void; onDone(): void }): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const lang = currentLang()

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    try {
      await window.api.visits.checkOut(visit.id, note)
      toast(t('checkout.done', { name: visit.fullName }))
      onDone()
    } catch (err) {
      toast(errorText(err, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <form className="card modal-card" onSubmit={submit}>
        <h2>{t('checkout.title')}</h2>
        <div className="visit-summary">
          <strong>{visit.fullName}</strong>
          {visit.fullNameAlt && <span dir="auto">{visit.fullNameAlt}</span>}
          <span className="muted">{[visit.company, visit.host].filter(Boolean).join(' · ')}</span>
          <span>{t('visitor.timeIn')}: {formatTime(visit.timeIn, lang)} · {t('visitor.duration')}: {formatDuration(visit.timeIn, null, lang)}</span>
          {visit.badgeNo && <span className="badge-chip">{t('visitor.badgeNo')}: {visit.badgeNo}</span>}
        </div>
        <label>{t('checkout.note')}<input value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></label>
        <div className="actions">
          <button type="button" onClick={onClose}>{t('common.cancel')}</button>
          <button className="primary" disabled={busy}>{t('checkout.confirm')}</button>
        </div>
      </form>
    </div>
  )
}
