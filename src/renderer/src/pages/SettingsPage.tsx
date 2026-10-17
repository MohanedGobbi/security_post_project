import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Role, Settings, User } from '@shared/types'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import { errorText, saveCameraId, savedCameraId } from '../util'
import CustomFieldsEditor from '../components/CustomFieldsEditor'
import FeaturesSettings from '../components/FeaturesSettings'
import ServerSettings from '../components/ServerSettings'
import BadgeSettingsCard from '../components/BadgeSettingsCard'

function CameraSettings(): ReactNode {
  const { t } = useTranslation()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selected, setSelected] = useState(savedCameraId() ?? '')
  useEffect(() => {
    // labels are only exposed after camera permission was granted once
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((s) => s.getTracks().forEach((tr) => tr.stop()))
      .catch(() => undefined)
      .finally(() => navigator.mediaDevices.enumerateDevices().then((ds) => setDevices(ds.filter((d) => d.kind === 'videoinput'))))
  }, [])
  return (
    <section className="card">
      <h2>{t('settings.camera')}</h2>
      <label>{t('settings.cameraDevice')}
        <select value={selected} onChange={(e) => { setSelected(e.target.value); saveCameraId(e.target.value) }}>
          <option value="">–</option>
          {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
        </select>
      </label>
    </section>
  )
}

function SiteSettings(): ReactNode {
  const { t } = useTranslation()
  const { toast, features } = useApp()
  const [s, setS] = useState<Settings | null>(null)
  useEffect(() => {
    window.api.settings.get().then(setS)
  }, [])
  if (!s) return null
  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    try {
      await window.api.settings.set(s)
      toast(t('settings.saved'))
    } catch (err) {
      toast(errorText(err, t), 'error')
    }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>{t('settings.site')}</h2>
      <label>{t('settings.siteName')}<input value={s.siteName} onChange={(e) => setS({ ...s, siteName: e.target.value })} dir="auto" /></label>
      <label>{t('settings.postName')}<input value={s.postName} onChange={(e) => setS({ ...s, postName: e.target.value })} dir="auto" /></label>
      <label>{t('settings.retentionDays')}
        <input type="number" min={1} max={3650} value={s.retentionDays} onChange={(e) => setS({ ...s, retentionDays: Number(e.target.value) })} />
      </label>
      <p className="hint">{t('settings.retentionHelp')}</p>
      <h3>{t('settings.alerts')}</h3>
      <div className="row2">
        <label>{t('settings.overstayHours')}
          <input type="number" min={0} max={240} value={s.overstayHours} onChange={(e) => setS({ ...s, overstayHours: Number(e.target.value) })} />
        </label>
        <label>{t('settings.closingTime')}
          <input type="time" value={s.closingTime} onChange={(e) => setS({ ...s, closingTime: e.target.value })} />
        </label>
        {features.modules.vehicles && (
          <label>{t('settings.vehicleOverstayHours')}
            <input type="number" min={0} max={240} value={s.vehicleOverstayHours} onChange={(e) => setS({ ...s, vehicleOverstayHours: Number(e.target.value) })} />
          </label>
        )}
        {features.modules.patrols && (
          <label>{t('settings.patrolIntervalHours')}
            <input type="number" min={0} max={240} value={s.patrolIntervalHours} onChange={(e) => setS({ ...s, patrolIntervalHours: Number(e.target.value) })} />
          </label>
        )}
      </div>
      <div className="actions"><button className="primary">{t('common.save')}</button></div>
    </form>
  )
}

function UserSettings(): ReactNode {
  const { t } = useTranslation()
  const { toast, user: me } = useApp()
  const [users, setUsers] = useState<User[]>([])
  const [nu, setNu] = useState({ name: '', role: 'guard' as Role, pin: '' })
  const [pinFor, setPinFor] = useState<number | null>(null)
  const [newPin, setNewPin] = useState('')

  const load = useCallback(() => {
    window.api.users.list().then(setUsers)
  }, [])
  useEffect(load, [load])

  const run = async (fn: () => Promise<void>, ok?: string): Promise<void> => {
    try {
      await fn()
      if (ok) toast(ok)
      load()
    } catch (err) {
      toast(errorText(err, t), 'error')
    }
  }

  const add = (e: FormEvent): void => {
    e.preventDefault()
    run(async () => {
      await window.api.users.create(nu.name, nu.role, nu.pin, currentLang())
      setNu({ name: '', role: 'guard', pin: '' })
    }, t('settings.saved'))
  }

  return (
    <section className="card users-card">
      <h2>{t('settings.users')}</h2>
      <table className="log-table">
        <thead><tr><th>{t('settings.name')}</th><th>{t('settings.role')}</th><th>{t('settings.active')}</th><th /></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={u.active ? '' : 'disabled'}>
              <td><strong>{u.name}</strong>{u.id === me.id && ' ★'}</td>
              <td>
                <select value={u.role} onChange={(e) => run(() => window.api.users.update(u.id, { role: e.target.value as Role }))}>
                  <option value="guard">{t('settings.roles.guard')}</option>
                  <option value="admin">{t('settings.roles.admin')}</option>
                </select>
              </td>
              <td>{t(u.active ? 'settings.active' : 'settings.inactive')}</td>
              <td className="row-actions">
                {pinFor === u.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); run(async () => { await window.api.users.update(u.id, { pin: newPin }); setPinFor(null); setNewPin('') }, t('settings.saved')) }}>
                    <input type="password" inputMode="numeric" maxLength={8} placeholder={t('settings.newPin')} value={newPin} onChange={(e) => setNewPin(e.target.value)} autoFocus />
                    <button className="primary">{t('common.save')}</button>
                    <button type="button" onClick={() => setPinFor(null)}>{t('common.cancel')}</button>
                  </form>
                ) : (
                  <>
                    <button type="button" onClick={() => { setPinFor(u.id); setNewPin('') }}>{t('settings.resetPin')}</button>
                    <button type="button" onClick={() => run(() => window.api.users.update(u.id, { active: !u.active }))}>
                      {t(u.active ? 'settings.deactivate' : 'settings.activate')}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="add-user" onSubmit={add}>
        <h3>{t('settings.addUser')}</h3>
        <div className="row3">
          <label>{t('settings.name')}<input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} required dir="auto" /></label>
          <label>{t('settings.role')}
            <select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as Role })}>
              <option value="guard">{t('settings.roles.guard')}</option>
              <option value="admin">{t('settings.roles.admin')}</option>
            </select>
          </label>
          <label>{t('settings.pin')}<input type="password" inputMode="numeric" maxLength={8} value={nu.pin} onChange={(e) => setNu({ ...nu, pin: e.target.value })} required /></label>
        </div>
        <div className="actions"><button className="primary">{t('settings.addUser')}</button></div>
      </form>
    </section>
  )
}

export default function SettingsPage(): ReactNode {
  const { t } = useTranslation()
  const { user, features } = useApp()
  return (
    <div className="settings-page">
      <h1>{t('settings.title')}</h1>
      <div className="settings-grid">
        <CameraSettings />
        {user.role === 'admin' && <FeaturesSettings />}
        {user.role === 'admin' && <SiteSettings />}
        {user.role === 'admin' && <ServerSettings />}
        {user.role === 'admin' && features.modules.badges && <BadgeSettingsCard />}
        {user.role === 'admin' && <UserSettings />}
        {user.role === 'admin' && <CustomFieldsEditor />}
      </div>
    </div>
  )
}
