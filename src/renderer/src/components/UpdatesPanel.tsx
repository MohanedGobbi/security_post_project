import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { UpdateInfo, UpdateState } from '@shared/types'
import { formatDateTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import Icon, { type IconName } from './Icon'
import SecureDialog from './SecureDialog'
import { errorText } from '../util'

const POLL_MS = 3000
const GIVE_UP_MS = 3 * 60_000
const BUSY: readonly UpdateState[] = ['checking', 'downloading', 'installing']

const ICON: Record<UpdateState | 'pending', IconName> = {
  pending: 'clock', checking: 'refresh', downloading: 'download', installing: 'download',
  up_to_date: 'check', updated: 'check', skipped: 'alert', failed: 'alert', error: 'alert'
}
const TONE: Record<UpdateState | 'pending', 'ok' | 'warn' | 'error' | 'info'> = {
  pending: 'info', checking: 'info', downloading: 'info', installing: 'info',
  up_to_date: 'ok', updated: 'ok', skipped: 'warn', failed: 'error', error: 'error'
}

/** what the panel waits for after "Check now": a new report of the updater, or another installed version */
interface Waiting { since: string | null; version: string; started: number }

/**
 * Administration → System → Updates. The program never updates itself: the button leaves a request file and a root
 * service on the PC (scripts/linux/updater/update.sh) does the work and writes its report, which this panel reads.
 */
export default function UpdatesPanel(): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const lang = currentLang()
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [asking, setAsking] = useState(false)
  const [waiting, setWaiting] = useState<Waiting | null>(null)
  const [reload, setReload] = useState(false)
  const waitRef = useRef<Waiting | null>(null)
  waitRef.current = waiting

  const settle = useCallback((next: UpdateInfo): void => {
    const w = waitRef.current
    if (!w) return
    const s = next.status
    const changedVersion = next.installed !== w.version
    const newReport = !!s && s.timestamp !== w.since && !BUSY.includes(s.state)
    if (!changedVersion && !newReport) return
    setWaiting(null)
    if (changedVersion || s?.state === 'updated') {
      setReload(true)
      toast(t('system.updates.doneUpdated', { version: next.installed }))
    } else if (s && (s.state === 'failed' || s.state === 'error')) {
      toast(t(`system.updates.state.${s.state}`), 'error')
    } else if (s) {
      toast(t(`system.updates.state.${s.state}`, { version: s.installed ?? next.installed, latest: s.latest ?? '' }))
    }
  }, [t, toast])

  const load = useCallback(async (quiet: boolean): Promise<void> => {
    try {
      const next = await window.api.system.updates()
      setInfo(next)
      settle(next)
    } catch (e) {
      // while the updater restarts the program a call can fail: expected, the next poll tells
      if (!quiet) toast(errorText(e, t), 'error')
    }
  }, [settle, toast, t])

  useEffect(() => { void load(false) }, [load])

  // already busy when the page opens (a request from earlier, or the nightly run): follow it as well
  useEffect(() => {
    if (!info || waitRef.current) return
    if (info.pending || (info.status && BUSY.includes(info.status.state))) {
      setWaiting({ since: info.pending ? info.status?.timestamp ?? null : null, version: info.installed, started: Date.now() })
    }
  }, [info])

  useEffect(() => {
    if (!waiting) return
    const timer = window.setInterval(() => {
      if (Date.now() - waiting.started > GIVE_UP_MS) {
        setWaiting(null)
        toast(t('system.updates.gaveUp'))
        return
      }
      void load(true)
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [waiting, load, toast, t])

  if (!info) return null
  const s = info.status
  // while waiting: the updater's own progress once it has written a new report, "requested" before that
  const line: UpdateState | 'pending' | null = waiting
    ? (s && s.timestamp !== waiting.since && BUSY.includes(s.state) ? s.state : 'pending')
    : s?.state ?? null
  const showDetails = !!s && (s.state === 'failed' || s.state === 'error' || s.state === 'skipped') && line === s.state

  return (
    <section className="card updates-card" aria-busy={!!waiting}>
      <div className="section-head">
        <h2>{t('system.updates.title')}</h2>
        {info.enabled && (
          <button type="button" className="primary" disabled={!!waiting} onClick={() => setAsking(true)}>
            <Icon name="refresh" /> {t('system.updates.checkNow')}
          </button>
        )}
      </div>
      <p className="hint">{t(info.enabled ? 'system.updates.intro' : 'system.updates.off')}</p>

      <dl className="updates-facts">
        <div><dt>{t('system.updates.installed')}</dt>
          <dd><bdi className="mono">{info.installed}</bdi>
            {info.commit && <span className="hint"> · <bdi className="mono">{info.commit.slice(0, 7)}</bdi></span>}
            {info.built && <span className="hint"> · {formatDateTime(info.built, lang)}</span>}</dd></div>
        {info.enabled && <div><dt>{t('system.updates.latest')}</dt><dd>{s?.latest ? <bdi className="mono">{s.latest}</bdi> : '—'}</dd></div>}
        {info.enabled && <div><dt>{t('system.updates.lastCheck')}</dt><dd>{s ? formatDateTime(s.timestamp, lang) : t('system.updates.never')}</dd></div>}
      </dl>

      {info.enabled && line && (
        <div className={`banner ${TONE[line]} updates-status`} role="status" aria-live="polite">
          {waiting ? <span className="spinner dark" aria-hidden /> : <Icon name={ICON[line]} />}
          <span>{t(`system.updates.state.${line}`, { version: s?.installed ?? info.installed, latest: s?.latest ?? '' })}</span>
        </div>
      )}
      {showDetails && s?.message && <p className="mono updates-detail"><bdi>{s.message}</bdi></p>}

      {reload && (
        <div className="actions start">
          <button type="button" className="primary" onClick={() => window.location.reload()}>
            <Icon name="refresh" /> {t('system.updates.reload')}
          </button>
        </div>
      )}

      {asking && (
        <SecureDialog title={t('system.updates.checkNow')} confirmLabel={t('system.updates.checkNow')} needPin onCancel={() => setAsking(false)}
          onConfirm={async ({ pin }) => {
            await window.api.system.checkUpdates(pin)
            setAsking(false)
            setReload(false)
            setWaiting({ since: info.status?.timestamp ?? null, version: info.installed, started: Date.now() })
            void load(true)
          }}>
          <p className="hint">{t('system.updates.dialog')}</p>
        </SecureDialog>
      )}
    </section>
  )
}
