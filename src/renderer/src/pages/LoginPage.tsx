import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Role, User } from '@shared/types'
import { LangSwitch } from '../App'
import { errorText } from '../util'
import BrandMark from '../components/BrandMark'
import { appTitle, BRAND, orgName } from '../brand'

interface LoginUser { id: number; name: string; role: Role }

interface Props {
  siteName: string
  onDone(u: User): void
  toast(t: string, k?: 'ok' | 'error'): void
}

/** The brand decides the login: pick your name then type the PIN, or the PIN alone (it says who you are). */
export default function LoginPage(props: Props): ReactNode {
  return BRAND.loginMode === 'pin' ? <PinOnlyLogin {...props} /> : <PickUserLogin {...props} />
}

/** Digits, Backspace and Enter from the physical keyboard work with the on-screen pad. */
function usePin(active: boolean, onEscape?: () => void): [string, (p: string | ((p: string) => string)) => void] {
  const [pin, setPin] = useState('')
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent): void => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < 8 ? p + e.key : p))
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
      else if (e.key === 'Enter') document.getElementById('pin-ok')?.click()
      else if (e.key === 'Escape') onEscape?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onEscape])
  return [pin, setPin]
}

function PinPad({ pin, setPin, busy, onOk }: {
  pin: string
  setPin(p: string | ((p: string) => string)): void
  busy: boolean
  onOk(): void
}): ReactNode {
  const { t } = useTranslation()
  const press = (d: string): void => setPin((p) => (p.length < 8 ? p + d : p))
  return (
    <>
      <div className="pin-dots" aria-label={t('login.enterPin')}>
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => <span key={i} className={i < pin.length ? 'on' : ''} />)}
      </div>
      <div className="pin-pad" dir="ltr">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} type="button" onClick={() => press(d)}>{d}</button>)}
        <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete">⌫</button>
        <button type="button" onClick={() => press('0')}>0</button>
        <button id="pin-ok" type="button" className="primary" disabled={pin.length < 4 || busy} onClick={onOk}>OK</button>
      </div>
    </>
  )
}

function PickUserLogin({ siteName, onDone, toast }: Props): ReactNode {
  const { t, i18n } = useTranslation()
  const [users, setUsers] = useState<LoginUser[]>([])
  const [selected, setSelected] = useState<LoginUser | null>(null)
  const [busy, setBusy] = useState(false)
  const [pin, setPin] = usePin(!!selected, () => { setSelected(null); setPin('') })

  useEffect(() => {
    window.api.auth.loginUsers().then((us) => {
      setUsers(us)
      if (us.length === 1) setSelected(us[0])
    })
  }, [])

  const submit = async (): Promise<void> => {
    if (!selected || pin.length < 4 || busy) return
    setBusy(true)
    try {
      onDone(await window.api.auth.login(selected.id, pin))
    } catch (e) {
      toast(errorText(e, t), 'error')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-screen login">
      <div className="card auth-card">
        <LangSwitch />
        <div className="login-head">
          <BrandMark big />
          <div><h1>{appTitle(i18n.language, t)}</h1>{siteName && <p className="muted">{siteName}</p>}</div>
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
            <PinPad pin={pin} setPin={setPin} busy={busy} onOk={submit} />
          </>
        )}
      </div>
    </div>
  )
}

/** Organisation login: its logos and program name, then only the PIN pad. */
function PinOnlyLogin({ onDone, toast }: Props): ReactNode {
  const { t, i18n } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [pin, setPin] = usePin(true)

  const submit = async (): Promise<void> => {
    if (pin.length < 4 || busy) return
    setBusy(true)
    try {
      onDone(await window.api.auth.loginPin(pin))
    } catch (e) {
      toast(errorText(e, t), 'error')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-screen login">
      <div className="card auth-card org-login">
        <LangSwitch />
        <div className="org-logos">
          {BRAND.logo && <img src={BRAND.logo} alt="" />}
          {BRAND.logo2 && <img src={BRAND.logo2} alt="" />}
        </div>
        <h1>{appTitle(i18n.language, t)}</h1>
        {orgName(i18n.language) && <p className="muted">{orgName(i18n.language)}</p>}
        <h2>{t('login.enterPin')}</h2>
        <PinPad pin={pin} setPin={setPin} busy={busy} onOk={submit} />
      </div>
    </div>
  )
}
