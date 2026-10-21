import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LangSwitch } from '../App'
import { errorText } from '../util'

/**
 * Shown instead of the login when the data key cannot be opened (the data belong to another Windows account or PC):
 * nobody can log in, so the way forward is a backup file and its password.
 */
export default function RecoveryPage(): ReactNode {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      setDone(await window.api.system.recover(password))
    } catch (err) {
      setError(errorText(err, t))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="center-screen">
      <form className="card shift-card" onSubmit={submit}>
        <div className="shift-head"><h1>{t('recovery.title')}</h1><LangSwitch /></div>
        <div className="banner warn">{t('recovery.text')}</div>
        <p className="hint">{t('recovery.help')}</p>
        <label>{t('secure.password')}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" autoFocus /></label>
        {error && <div className="banner error">{error}</div>}
        {done && <div className="banner ok">{t('system.restarting')}</div>}
        <div className="actions"><button className="primary big" disabled={busy || !password}>{t('recovery.choose')}</button></div>
      </form>
    </div>
  )
}
