import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfileId, User } from '@shared/types'
import { LangSwitch } from '../App'
import { currentLang } from '../i18n'
import { errorText } from '../util'

const PROFILE_IDS: ProfileId[] = ['small', 'company', 'large']

export default function SetupPage({ onDone, toast }: { onDone(u: User): void; toast(t: string, k?: 'ok' | 'error'): void }): ReactNode {
  const { t } = useTranslation()
  const [f, setF] = useState({ siteName: '', postName: '', adminName: '', pin: '', pin2: '' })
  const [profile, setProfile] = useState<ProfileId>('company')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!/^\d{4,8}$/.test(f.pin)) return toast(t('setup.pinShort'), 'error')
    if (f.pin !== f.pin2) return toast(t('setup.pinMismatch'), 'error')
    setBusy(true)
    try {
      const u = await window.api.auth.setup({
        siteName: f.siteName, postName: f.postName, adminName: f.adminName, pin: f.pin, language: currentLang(), profile
      })
      onDone(u)
    } catch (err) {
      toast(errorText(err, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-screen">
      <form className="card auth-card setup-card" onSubmit={submit}>
        <LangSwitch />
        <h1>{t('setup.title')}</h1>
        <p className="muted">{t('setup.intro')}</p>
        <label>{t('setup.siteName')}<input value={f.siteName} onChange={set('siteName')} required autoFocus /></label>
        <label>{t('setup.postName')}<input value={f.postName} onChange={set('postName')} /></label>

        <fieldset className="profile-pick">
          <legend>{t('setup.profile')}</legend>
          <div className="profile-grid">
            {PROFILE_IDS.map((id) => (
              <label key={id} className={`profile-card ${profile === id ? 'on' : ''}`}>
                <input type="radio" name="profile" value={id} checked={profile === id} onChange={() => setProfile(id)} />
                <strong>{t(`features.profiles.${id}.name`)}</strong>
                <span className="muted">{t(`features.profiles.${id}.desc`)}</span>
              </label>
            ))}
          </div>
          <p className="hint">{t('setup.profileHint')}</p>
        </fieldset>

        <label>{t('setup.adminName')}<input value={f.adminName} onChange={set('adminName')} required /></label>
        <div className="row2">
          <label>{t('setup.pin')}<input type="password" inputMode="numeric" value={f.pin} onChange={set('pin')} required maxLength={8} /></label>
          <label>{t('setup.pinConfirm')}<input type="password" inputMode="numeric" value={f.pin2} onChange={set('pin2')} required maxLength={8} /></label>
        </div>
        <button className="primary big" disabled={busy}>{t('setup.create')}</button>
      </form>
    </div>
  )
}
