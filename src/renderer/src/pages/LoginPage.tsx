import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Role, User } from '@shared/types'
import { LangSwitch } from '../App'
import { errorText } from '../util'
import Icon from '../components/Icon'

interface LoginUser { id: number; name: string; role: Role }

export default function LoginPage({ siteName, onDone, toast }: {
  siteName: string
  onDone(u: User): void
  toast(t: string, k?: 'ok' | 'error'): void
}): ReactNode {
  const { t } = useTranslation()
  const [users, setUsers] = useState<LoginUser[]>([])
  const [selected, setSelected] = useState<LoginUser | null>(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.api.auth.loginUsers().then((us) => {
      setUsers(us)
      if (us.length === 1) setSelected(us[0])
    })
  }, [])

  const submit = async (value = pin): Promise<void> => {
    if (!selected || value.length < 4 || busy) return
    setBusy(true)
    try {
      onDone(await window.api.auth.login(selected.id, value))
    } catch (e) {
      toast(errorText(e, t), 'error')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  // physical keyboard works with the on-screen pad
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent): void => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < 8 ? p + e.key : p))
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
      else if (e.key === 'Enter') document.getElementById('pin-ok')?.click()
      else if (e.key === 'Escape') { setSelected(null); setPin('') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const press = (d: string): void => setPin((p) => (p.length < 8 ? p + d : p))

  return (
    <div className="center-screen login">
      <div className="card auth-card">
        <LangSwitch />
        <div className="login-head">
          <span className="brand-mark big"><Icon name="shield" size={30} /></span>
          <div><h1>{t('app.title')}</h1>{siteName && <p className="muted">{siteName}</p>}</div>
        </div>
        {!selected ? (
          <>
            <h2>{t('login.title')}</h2>
            <div className="user-grid">
              {users.map((u) => (
                <button key={u.id} type="button" className="user-tile" onClick={() => setSelected(u)}>
                  <span className="avatar">{u.name.trim().charAt(0).toUpperCase()}</span>
                  <span>{u.name}</span>
                  <small>{t(`settings.roles.${u.role}`)}</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button type="button" className="link" onClick={() => { setSelected(null); setPin('') }}>← {selected.name}</button>
            <h2>{t('login.enterPin')}</h2>
            <div className="pin-dots" aria-label={t('login.enterPin')}>
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => <span key={i} className={i < pin.length ? 'on' : ''} />)}
            </div>
            <div className="pin-pad" dir="ltr">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} type="button" onClick={() => press(d)}>{d}</button>)}
              <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete">⌫</button>
              <button type="button" onClick={() => press('0')}>0</button>
              <button id="pin-ok" type="button" className="primary" disabled={pin.length < 4 || busy} onClick={() => submit()}>OK</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
