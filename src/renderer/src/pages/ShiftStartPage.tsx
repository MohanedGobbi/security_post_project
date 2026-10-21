import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Features, RegisterDef, ShiftState, User } from '@shared/types'
import { labelOf } from '@shared/registers'
import { formatDateTime } from '@shared/i18n'
import { can } from '@shared/permissions'
import { LangSwitch } from '../App'
import { currentLang } from '../i18n'
import ShiftSummaryGrid from '../components/ShiftSummaryGrid'
import Icon from '../components/Icon'
import { errorText } from '../util'
import { BRAND } from '../brand'
import RegisterEntryForm from '../components/RegisterEntryForm'

export default function ShiftStartPage({ user, onStarted, onLogout, toast }: {
  user: User
  onStarted(): void
  onLogout(): void
  toast(t: string, k?: 'ok' | 'error'): void
}): ReactNode {
  const { t } = useTranslation()
  const [s, setS] = useState<ShiftState | null>(null)
  const [busy, setBusy] = useState(false)
  /** registers a team leader fills before the shift starts (the paper handover), and the one being filled */
  const [steps, setSteps] = useState<RegisterDef[]>([])
  const [step, setStep] = useState<number | null>(null)
  const [features, setFeatures] = useState<Features | undefined>(undefined)
  const lang = currentLang()

  useEffect(() => {
    window.api.shifts.state().then(setS)
    window.api.settings.getFeatures().then(setFeatures)
    if (can(user, 'shiftHandover') && user.role !== 'admin' && BRAND.leaderStartRegisters.length) {
      window.api.registers.list().then((rs) => setSteps(BRAND.leaderStartRegisters
        .map((k) => rs.find((r) => r.key === k && r.active && r.fillRoles.includes(user.role)))
        .filter((r): r is RegisterDef => !!r)))
    }
  }, [user.role, user.permissions])

  const start = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.shifts.start()
      onStarted()
    } catch (e) {
      toast(errorText(e, t), 'error')
      setBusy(false)
    }
  }

  // team leader: the shift register, then the custody check (each names the outgoing leader)
  const current = step !== null ? steps[step] : null
  if (current) {
    return (
      <div className="center-screen">
        <div className="card shift-card">
          <div className="shift-head">
            <div>
              <h1>{labelOf(current.labels, lang)}</h1>
              <p className="muted">{t('shift.leaderStep', { n: (step ?? 0) + 1, total: steps.length })} · {user.name}</p>
            </div>
          </div>
          <RegisterEntryForm key={current.id} reg={current} toast={toast} title={t('shift.leaderFill')}
            onSaved={() => (step !== null && step + 1 < steps.length ? setStep(step + 1) : start())}>
            <button type="button" onClick={() => setStep(step && step > 0 ? step - 1 : null)}>{t('common.back')}</button>
          </RegisterEntryForm>
        </div>
      </div>
    )
  }

  return (
    <div className="center-screen">
      <div className="card shift-card">
        <div className="shift-head">
          <div>
            <h1>{t('shift.startTitle')}</h1>
            <p className="muted">{user.name} · {t('shift.startIntro')}</p>
          </div>
          <LangSwitch onChange={(l) => window.api.auth.setLanguage(l)} />
        </div>
        {!s ? <p>{t('common.loading')}</p> : (
          <>
            {s.othersOpen.map((o) => (
              <div key={o.id} className="banner warn"><Icon name="alert" /> {t('shift.othersOpen', { name: o.guard, date: formatDateTime(o.startedAt, lang) })}</div>
            ))}
            <section>
              <h2>{t('shift.handover')}</h2>
              {s.previous ? (
                <>
                  <p className="muted">{t('shift.previous', { name: s.previous.guard, date: formatDateTime(s.previous.endedAt, lang) })}</p>
                  {s.previous.handoverNote
                    ? <div className="handover-note" dir="auto">{s.previous.handoverNote}</div>
                    : <p className="empty">{t('shift.noHandover')}</p>}
                </>
              ) : <p className="empty">{t('shift.noPrevious')}</p>}
            </section>
            <section>
              <h2>{t('shift.situation')}</h2>
              <ShiftSummaryGrid summary={s.summary} part="live" features={features} />
            </section>
            <div className="actions">
              <button type="button" onClick={onLogout}>{t('nav.logout')}</button>
              <button type="button" className="primary big" disabled={busy} onClick={steps.length ? () => setStep(0) : start} autoFocus>
                {steps.length ? t('shift.startLeader') : t('shift.start')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
