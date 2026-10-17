import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ShiftState, User } from '@shared/types'
import { formatDateTime } from '@shared/i18n'
import { LangSwitch } from '../App'
import { currentLang } from '../i18n'
import ShiftSummaryGrid from '../components/ShiftSummaryGrid'
import Icon from '../components/Icon'
import { errorText } from '../util'

export default function ShiftStartPage({ user, onStarted, onLogout, toast }: {
  user: User
  onStarted(): void
  onLogout(): void
  toast(t: string, k?: 'ok' | 'error'): void
}): ReactNode {
  const { t } = useTranslation()
  const [s, setS] = useState<ShiftState | null>(null)
  const [busy, setBusy] = useState(false)
  const lang = currentLang()

  useEffect(() => {
    window.api.shifts.state().then(setS)
  }, [])

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
              <ShiftSummaryGrid summary={s.summary} part="live" />
            </section>
            <div className="actions">
              <button type="button" onClick={onLogout}>{t('nav.logout')}</button>
              <button type="button" className="primary big" disabled={busy} onClick={start} autoFocus>{t('shift.start')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
