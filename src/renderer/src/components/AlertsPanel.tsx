import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { AlertItem, AlertKind } from '@shared/types'
import { formatDateTime, formatDuration } from '@shared/i18n'
import { useApp, type Page } from '../App'
import { currentLang } from '../i18n'
import Icon from './Icon'

const TARGET: Record<AlertKind, Page> = {
  visitor_overstay: 'out', visitor_after_closing: 'out', vehicle_overstay: 'vehicles', key_overdue: 'keys', patrol_due: 'patrols'
}

/** Things that need attention now; each line opens the screen where it is handled. */
export default function AlertsPanel({ alerts }: { alerts: AlertItem[] }): ReactNode {
  const { t } = useTranslation()
  const { go } = useApp()
  const lang = currentLang()
  if (alerts.length === 0) return null

  const detail = (a: AlertItem): string => {
    if (a.kind === 'patrol_due') return a.since ? t('alert.patrolSince', { time: formatDateTime(a.since, lang) }) : t('alert.patrolNever')
    if (a.kind === 'key_overdue') return `${a.detail} · ${t('alert.due', { time: formatDateTime(a.since, lang) })}`
    return [a.detail, a.since && `${t('alert.since', { time: formatDateTime(a.since, lang) })} (${formatDuration(a.since, null, lang)})`].filter(Boolean).join(' · ')
  }

  return (
    <section className="card alerts-card" aria-live="polite">
      <div className="section-head">
        <h2><Icon name="alert" /> {t('alert.title')}</h2>
        <span className="count-pill danger">{alerts.length}</span>
      </div>
      <ul className="alert-list">
        {alerts.map((a, i) => (
          <li key={`${a.kind}-${a.refId ?? i}`}>
            <button type="button" onClick={() => go(TARGET[a.kind])}>
              <span className={`tag alert-${a.kind}`}>{t(`alert.kind.${a.kind}`)}</span>
              {a.title && <strong dir="auto">{a.title}</strong>}
              <span className="muted" dir="auto">{detail(a)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
