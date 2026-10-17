import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { VisitRow } from '@shared/types'
import { formatDuration, formatTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import CheckOutDialog from './CheckOutDialog'
import Icon from './Icon'
import { errorText } from '../util'

/** List of people currently inside, each with a one-tap exit button. */
export default function InsideList({ rows, onChanged, emptyText }: { rows: VisitRow[]; onChanged(): void; emptyText: string }): ReactNode {
  const { t } = useTranslation()
  const [leaving, setLeaving] = useState<VisitRow | null>(null)
  const { alerts, refreshAlerts, features, toast } = useApp()
  // visitors flagged by an overstay / closing-time alert
  const flagged = new Map(alerts.filter((a) => a.kind === 'visitor_overstay' || a.kind === 'visitor_after_closing').map((a) => [a.refId, a.kind]))
  const lang = currentLang()

  if (rows.length === 0) return <p className="empty">{emptyText}</p>
  return (
    <>
      <ul className="inside-list">
        {rows.map((v) => (
          <li key={v.id} className={flagged.has(v.id) ? 'overstay' : ''}>
            <div className="who-col">
              <strong>{v.fullName}</strong>
              <span className="muted">{[v.company, v.host && `→ ${v.host}`].filter(Boolean).join(' ')}</span>
            </div>
            <div className="meta-col">
              {v.badgeNo && <span className="badge-chip">#{v.badgeNo}</span>}
              {v.vehiclePlate && <span className="plate">{v.vehiclePlate}</span>}
              <span title={formatTime(v.timeIn, lang)}>{t('home.since', { time: formatTime(v.timeIn, lang) })}</span>
              <span className={flagged.has(v.id) ? 'overdue-text' : 'muted'}>{formatDuration(v.timeIn, null, lang)}</span>
              {flagged.has(v.id) && <span className="tag sev-high">{t(`alert.kind.${flagged.get(v.id)}`)}</span>}
            </div>
            <div className="row-actions">
              {features.modules.badges && (
                <button type="button" className="icon-btn" aria-label={t('badge.print')} title={t('badge.print')}
                  onClick={() => window.api.badges.print(v.id).catch((e) => toast(errorText(e, t), 'error'))}>
                  <Icon name="printer" size={18} />
                </button>
              )}
              <button type="button" className="exit-btn" onClick={() => setLeaving(v)}>{t('home.checkOut')}</button>
            </div>
          </li>
        ))}
      </ul>
      {leaving && <CheckOutDialog visit={leaving} onClose={() => setLeaving(null)} onDone={() => { setLeaving(null); onChanged(); refreshAlerts() }} />}
    </>
  )
}
