import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { WatchHit } from '@shared/types'
import Icon from './Icon'

/** true when the hits must stop the entry (same rule as the backend: name-only matches only warn) */
export const isBlocking = (hits: WatchHit[]): boolean => hits.some((h) => h.level === 'deny' && h.match !== 'name')

/**
 * Full-screen red alert shown as soon as a scanned / typed person or plate is on the watchlist.
 * With `onOverride`, it also asks for a supervisor PIN to let the entry through.
 */
export default function WatchAlert({ hits, onClose, onOverride }: {
  hits: WatchHit[]
  onClose(): void
  onOverride?(pin: string): void
}): ReactNode {
  const { t } = useTranslation()
  const [pin, setPin] = useState('')
  const blocking = isBlocking(hits)
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    okRef.current?.focus()
  }, [])

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (pin.length >= 4) onOverride?.(pin)
  }

  return (
    <div className="modal watch-modal" role="alertdialog" aria-modal onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className={`card modal-card watch-card ${blocking ? 'deny' : 'alert'}`}>
        <div className="watch-head">
          <Icon name="alert" size={40} />
          <h2>{t(blocking ? 'watch.denyTitle' : 'watch.alertTitle')}</h2>
        </div>
        <ul className="watch-hits">
          {hits.map((h) => (
            <li key={h.id}>
              <strong dir="auto">{h.name || '—'}</strong>
              <span className={`tag level-${h.level}`}>{t(`watch.levels.${h.level}`)}</span>
              <span className="muted">{t(h.match === 'id' ? 'watch.matchId' : h.match === 'plate' ? 'watch.matchPlate' : 'watch.matchName')}</span>
              <p dir="auto">{h.reason}</p>
            </li>
          ))}
        </ul>
        <p className="watch-instruction">{t(blocking ? 'watch.denyText' : 'watch.alertText')}</p>
        {blocking && onOverride ? (
          <form onSubmit={submit} className="override">
            <label>{t('watch.supervisorPin')}
              <input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value)} />
            </label>
            <div className="actions">
              <button type="button" ref={okRef} onClick={onClose}>{t('common.cancel')}</button>
              <button className="danger" disabled={pin.length < 4}>{t('watch.override')}</button>
            </div>
          </form>
        ) : (
          <div className="actions"><button type="button" ref={okRef} className="primary" onClick={onClose}>{t('watch.understood')}</button></div>
        )}
      </div>
    </div>
  )
}
