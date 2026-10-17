import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Features, Module, ProfileId } from '@shared/types'
import { MODULES, matchingProfile, PROFILES } from '@shared/features'
import { useApp } from '../App'
import { errorText } from '../util'

type VisitorOption = 'idScan' | 'visitorPhoto' | 'requireIdNumber' | 'badgeNumbers'
const VISITOR_OPTIONS: VisitorOption[] = ['idScan', 'visitorPhoto', 'requireIdNumber', 'badgeNumbers']
const PROFILE_IDS: ProfileId[] = ['small', 'company', 'large']

function Switch({ on, onChange, name, desc }: { on: boolean; onChange(v: boolean): void; name: string; desc: string }): ReactNode {
  return (
    <label className={`switch-row ${on ? 'on' : ''}`}>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden />
      <span className="switch-text"><strong>{name}</strong><span className="muted">{desc}</span></span>
    </label>
  )
}

/** Administrator screen: which parts of the program this site uses. */
export default function FeaturesSettings(): ReactNode {
  const { t } = useTranslation()
  const { features, refreshFeatures, toast } = useApp()
  const [f, setF] = useState<Features>(features)
  const [busy, setBusy] = useState(false)

  useEffect(() => setF(features), [features])

  const dirty = JSON.stringify(f) !== JSON.stringify(features)
  const profile = matchingProfile(f)

  const setModule = (m: Module, on: boolean): void => setF({ ...f, modules: { ...f.modules, [m]: on } })
  const setOption = (o: VisitorOption, on: boolean): void => setF({ ...f, [o]: on })

  const save = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.settings.setFeatures(f)
      await refreshFeatures()
      toast(t('features.saved'))
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card users-card features-card">
      <h2>{t('features.title')}</h2>
      <p className="hint">{t('features.intro')}</p>

      <h3>{t('features.profile')}</h3>
      <p className="hint">{t('features.profileHint')}</p>
      <div className="profile-grid">
        {PROFILE_IDS.map((id) => (
          <button key={id} type="button" className={`profile-card ${profile === id ? 'on' : ''}`} onClick={() => setF(PROFILES[id])}>
            <strong>{t(`features.profiles.${id}.name`)}</strong>
            <span className="muted">{t(`features.profiles.${id}.desc`)}</span>
            {profile === id && <span className="tag inside">{t('features.current')}</span>}
          </button>
        ))}
      </div>
      {!profile && <p className="hint">{t('features.custom')}</p>}

      <div className="features-cols">
        <div>
          <h3>{t('features.modules')}</h3>
          {MODULES.map((m) => (
            <Switch key={m} on={f.modules[m]} onChange={(v) => setModule(m, v)}
              name={t(`features.module.${m}.name`)} desc={t(`features.module.${m}.desc`)} />
          ))}
        </div>
        <div>
          <h3>{t('features.visitorForm')}</h3>
          {VISITOR_OPTIONS.map((o) => (
            <Switch key={o} on={f[o]} onChange={(v) => setOption(o, v)}
              name={t(`features.opt.${o}.name`)} desc={t(`features.opt.${o}.desc`)} />
          ))}
          <p className="hint always">{t('features.always')}</p>
        </div>
      </div>

      <div className="actions">
        {dirty && <button type="button" onClick={() => setF(features)}>{t('common.cancel')}</button>}
        <button type="button" className="primary" disabled={!dirty || busy} onClick={save}>{t('common.save')}</button>
      </div>
    </section>
  )
}
