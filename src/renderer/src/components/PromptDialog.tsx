import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../App'
import { errorText } from '../util'

/** Small confirm dialog with one text field (exit note, who collects a parcel, incident resolution…). */
export default function PromptDialog({ title, summary, label, confirmLabel, required, multiline, onConfirm, onClose }: {
  title: string
  summary?: ReactNode
  label: string
  confirmLabel: string
  required?: boolean
  multiline?: boolean
  onConfirm(value: string): Promise<void>
  onClose(): void
}): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    try {
      await onConfirm(value)
    } catch (err) {
      toast(errorText(err, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <form className="card modal-card" onSubmit={submit}>
        <h2>{title}</h2>
        {summary && <div className="visit-summary">{summary}</div>}
        <label>{label}
          {multiline
            ? <textarea rows={3} value={value} onChange={(e) => setValue(e.target.value)} dir="auto" autoFocus required={required} />
            : <input value={value} onChange={(e) => setValue(e.target.value)} dir="auto" autoFocus required={required} />}
        </label>
        <div className="actions">
          <button type="button" onClick={onClose}>{t('common.cancel')}</button>
          <button className="primary" disabled={busy || (required && !value.trim())}>{confirmLabel}</button>
        </div>
      </form>
    </div>
  )
}
