import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../App'
import { errorText } from '../util'

export interface SecureValues { pin: string; password: string }

/**
 * A confirmation for something that cannot be undone, or needs a secret: the administrator's PIN again,
 * a password (two times when a new one is chosen) and/or a word typed to show it is meant.
 */
export default function SecureDialog({ title, children, confirmLabel, danger = false, needPin = false, password, confirmWord, onCancel, onConfirm }: {
  title: string
  children?: ReactNode
  confirmLabel: string
  danger?: boolean
  needPin?: boolean
  /** 'enter' = type the password of an existing file; 'choose' = choose one (typed twice) */
  password?: 'enter' | 'choose'
  confirmWord?: string
  onCancel(): void
  onConfirm(v: SecureValues): Promise<void>
}): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [pin, setPin] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = (!needPin || pin.length >= 4) && (!password || pw.length >= 1) && (password !== 'choose' || (pw.length >= 6 && pw === pw2)) && (!confirmWord || word.trim() === confirmWord)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    try {
      await onConfirm({ pin, password: pw })
    } catch (err) {
      toast(errorText(err, t), 'error')
      setBusy(false)
    }
  }
  return (
    <div className="modal" role="dialog" aria-modal onKeyDown={(e) => e.key === 'Escape' && !busy && onCancel()}>
      <form className="card modal-card" onSubmit={submit}>
        <h2>{title}</h2>
        {children}
        {password && (
          <label>{t(password === 'choose' ? 'secure.choosePassword' : 'secure.password')}
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" autoComplete="off" autoFocus />
          </label>
        )}
        {password === 'choose' && (
          <>
            <label>{t('secure.repeatPassword')}<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} dir="ltr" autoComplete="off" /></label>
            <p className="hint">{t('secure.passwordHelp')}</p>
          </>
        )}
        {confirmWord && (
          <label>{t('secure.typeWord', { word: confirmWord })}<input value={word} onChange={(e) => setWord(e.target.value)} dir="auto" autoComplete="off" /></label>
        )}
        {needPin && (
          <label>{t('secure.pin')}<input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value)} dir="ltr" autoComplete="off" autoFocus={!password} /></label>
        )}
        <div className="actions">
          <button type="button" onClick={onCancel} disabled={busy}>{t('common.cancel')}</button>
          <button className={danger ? 'primary danger' : 'primary'} disabled={!ready || busy}>{confirmLabel}</button>
        </div>
      </form>
    </div>
  )
}
