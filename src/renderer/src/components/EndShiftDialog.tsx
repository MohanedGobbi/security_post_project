import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ShiftState } from '@shared/types'
import { formatDateTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import ShiftSummaryGrid from './ShiftSummaryGrid'
import { errorText } from '../util'

export default function EndShiftDialog({ onClose, onEnded }: { onClose(): void; onEnded(): void }): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [s, setS] = useState<ShiftState | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [withReport, setWithReport] = useState(true)
  const lang = currentLang()

  useEffect(() => {
    window.api.shifts.state().then(setS)
  }, [])

  const run = async (fn: () => Promise<void>): Promise<void> => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  // the report is made after closing the shift, so it contains the end time and the handover note
  const end = (): Promise<void> => run(async () => {
    const shift = await window.api.shifts.end(note)
    if (withReport) {
      const path = await window.api.exports.shiftReport(shift.id, lang)
      if (path) toast(t('export.saved', { path }))
    }
    toast(t('shift.ended'))
    onEnded()
  })

  return (
    <div className="modal" role="dialog" aria-modal onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="card modal-card wide">
        <h2>{t('shift.endTitle')}</h2>
        {!s?.mine ? <p>{t('common.loading')}</p> : (
          <>
            <p className="muted">{t('shift.endIntro', { date: formatDateTime(s.mine.startedAt, lang) })}</p>
            <ShiftSummaryGrid summary={s.summary} part="done" />
            <h3>{t('shift.situation')}</h3>
            <ShiftSummaryGrid summary={s.summary} part="live" />
            <label className="handover-label">{t('shift.handover')}
              <textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('shift.handoverPlaceholder')} dir="auto" autoFocus />
            </label>
            <div className="actions">
              <label className="check"><input type="checkbox" checked={withReport} onChange={(e) => setWithReport(e.target.checked)} /> {t('shift.report')}</label>
              <span className="spacer" />
              <button type="button" onClick={onClose}>{t('common.cancel')}</button>
              <button type="button" className="primary" disabled={busy} onClick={end}>{t('shift.end')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
