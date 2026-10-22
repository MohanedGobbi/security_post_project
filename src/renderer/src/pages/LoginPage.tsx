import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { User } from '@shared/types'
import { LangSwitch } from '../App'
import { errorText } from '../util'
import { appTitle, BRAND, orgName } from '../brand'
import rowdLogo from '../assets/brands/rowd-tech.png'

interface Props {
  siteName: string
  onDone(u: User): void
  toast(t: string, k?: 'ok' | 'error'): void
}

/** The PIN alone says who is logging in (PINs are unique): no list of names, no username. */
export default function LoginPage(props: Props): ReactNode {
  return <PinOnlyLogin {...props} />
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
          <img src={BRAND.logo} alt="" />
          <img src={BRAND.logo2} alt="" />
        </div>
        <h1>{appTitle(i18n.language)}</h1>
        <p className="muted">{orgName(i18n.language)}</p>
        <h2>{t('login.enterPin')}</h2>
        <PinPad pin={pin} setPin={setPin} busy={busy} onOk={submit} />
        <p className="made-by"><img src={rowdLogo} alt="" /><span>{t('login.madeBy')}</span></p>
      </div>
    </div>
  )
}
