import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { errText, get, patch, put } from '../api'
import { useDash } from '../App'

/** Own password, and (owner) how long the server keeps records */
export default function AccountPage(): ReactNode {
  const { t } = useTranslation()
  const { toast, me } = useDash()
  const [pw, setPw] = useState({ a: '', b: '' })
  const [days, setDays] = useState<number | null>(null)

  useEffect(() => {
    if (me.role === 'owner') get<{ retentionDays: number }>('/api/settings').then((s) => setDays(s.retentionDays))
  }, [me.role])

  const changePw = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (pw.a !== pw.b) return toast(t('dash.err.password_mismatch'), 'error')
    try {
      await patch('/api/me', { password: pw.a })
      setPw({ a: '', b: '' })
      toast(t('settings.saved'))
    } catch (err) {
      toast(errText(err, t), 'error')
    }
  }

  const saveDays = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    try {
      await put('/api/settings', { retentionDays: days })
      toast(t('settings.saved'))
    } catch (err) {
      toast(errText(err, t), 'error')
    }
  }

  return (
    <div className="settings-page">
      <h1>{t('dash.nav.account')}</h1>
      <div className="settings-grid">
        <form className="card" onSubmit={changePw}>
          <h2>{me.name}</h2>
          <p className="muted">{me.email} · {t(`dash.roles.${me.role}`)}</p>
          <label>{t('dash.user.newPassword')}<input type="password" minLength={8} value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} required autoComplete="new-password" /></label>
          <label>{t('dash.user.confirmPassword')}
            <input type="password" minLength={8} value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} required autoComplete="new-password" />
          </label>
          <div className="actions"><button className="primary">{t('dash.user.changePassword')}</button></div>
        </form>
        {days !== null && (
          <form className="card" onSubmit={saveDays}>
            <h2>{t('dash.serverSettings')}</h2>
            <label>{t('settings.retentionDays')}<input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>
            <p className="hint">{t('dash.retentionHelp')}</p>
            <div className="actions"><button className="primary">{t('common.save')}</button></div>
          </form>
        )}
      </div>
    </div>
  )
}
