import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ShiftSummary } from '@shared/types'
import { ALL_ON, summaryKeyOn } from '@shared/features'
import { useApp } from '../App'

const DONE: (keyof ShiftSummary)[] = ['visitorsIn', 'visitorsOut', 'vehiclesIn', 'vehiclesOut', 'parcelsReceived', 'parcelsPickedUp', 'incidents', 'patrols', 'notes']
const LIVE: (keyof ShiftSummary)[] = ['insideNow', 'vehiclesInside', 'parcelsWaiting', 'openIncidents', 'keysOut']

/** Counters of a shift (what happened) and the live situation (what the next guard inherits). */
export default function ShiftSummaryGrid({ summary, part }: { summary: ShiftSummary; part: 'done' | 'live' }): ReactNode {
  const { t } = useTranslation()
  // also shown on the start-of-shift screen, before the app context exists
  const features = useApp()?.features ?? ALL_ON
  const keys = (part === 'done' ? DONE : LIVE).filter((k) => summaryKeyOn(k, features))
  return (
    <div className={`sum-grid ${part}`}>
      {keys.map((k) => (
        <div key={k} className={part === 'live' && summary[k] > 0 && (k === 'openIncidents' || k === 'parcelsWaiting' || k === 'keysOut') ? 'attention' : ''}>
          <strong>{summary[k]}</strong>
          <span>{t(`shift.sum.${k}`)}</span>
        </div>
      ))}
    </div>
  )
}
