import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Checkpoint, PatrolCheck, PatrolRound, PatrolRoundDetail } from '@shared/types'
import { formatDateTime, formatTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import PromptDialog from '../components/PromptDialog'
import Icon from '../components/Icon'
import QrScanner from '../components/QrScanner'
import { errorText, todayStr } from '../util'

function CheckRow({ c, onCheck }: { c: PatrolCheck; onCheck(status: 'ok' | 'issue', note: string): void }): ReactNode {
  const { t } = useTranslation()
  const [issue, setIssue] = useState(false)
  const [note, setNote] = useState(c.note)
  const lang = currentLang()

  const submitIssue = (e: FormEvent): void => {
    e.preventDefault()
    if (note.trim()) {
      onCheck('issue', note)
      setIssue(false)
    }
  }

  return (
    <li className={`check-row ${c.status ?? 'todo'}`}>
      <div className="who-col">
        <strong>{c.name}</strong>
        <span className="muted">{c.location}</span>
        {c.status === 'issue' && <span className="issue-note" dir="auto">{c.note}</span>}
      </div>
      <div className="meta-col">
        {c.time
          ? <span>{formatTime(c.time, lang)} · {t(c.method === 'qr' ? 'patrol.viaQr' : 'patrol.manual')}</span>
          : <span className="muted">{t('patrol.notVisited')}</span>}
      </div>
      <div className="check-actions">
        <button type="button" className={c.status === 'ok' ? 'ok on' : 'ok'} onClick={() => onCheck('ok', '')}>{t('patrol.ok')}</button>
        <button type="button" className={c.status === 'issue' ? 'issue on' : 'issue'} onClick={() => setIssue(!issue)}>{t('patrol.issue')}</button>
      </div>
      {issue && (
        <form className="issue-form" onSubmit={submitIssue}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('patrol.issueNote')} dir="auto" autoFocus />
          <button className="primary" disabled={!note.trim()}>{t('common.save')}</button>
        </form>
      )}
    </li>
  )
}

function CheckpointAdmin({ onChanged }: { onChanged(): void }): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [list, setList] = useState<Checkpoint[]>([])
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const lang = currentLang()

  const load = useCallback(() => {
    window.api.patrols.checkpoints(true).then(setList)
  }, [])
  useEffect(load, [load])

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      load()
      onChanged()
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  const add = (e: FormEvent): void => {
    e.preventDefault()
    run(async () => {
      await window.api.patrols.addCheckpoint(name, location)
      setName('')
      setLocation('')
    })
  }

  const labels = async (): Promise<void> => {
    try {
      const path = await window.api.patrols.labelsPdf(lang)
      if (path) toast(t('export.saved', { path }))
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  return (
    <section className="card">
      <div className="section-head">
        <h2>{t('patrol.checkpoints')}</h2>
        <button type="button" onClick={labels} disabled={!list.some((c) => c.active)}>{t('patrol.labels')}</button>
      </div>
      {list.length > 0 && (
        <div className="table-wrap">
          <table className="log-table static">
            <thead><tr><th>{t('patrol.name')}</th><th>{t('patrol.location')}</th><th>{t('patrol.code')}</th><th /></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className={c.active ? '' : 'disabled'}>
                  <td><strong>{c.name}</strong></td><td dir="auto">{c.location}</td><td className="mono">{c.code}</td>
                  <td className="row-actions">
                    <button type="button" onClick={() => run(() => window.api.patrols.updateCheckpoint(c.id, { active: !c.active }))}>
                      {t(c.active ? 'patrol.disable' : 'patrol.enable')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form className="inline-form" onSubmit={add}>
        <label>{t('patrol.name')}<input value={name} onChange={(e) => setName(e.target.value)} dir="auto" required /></label>
        <label className="grow">{t('patrol.location')}<input value={location} onChange={(e) => setLocation(e.target.value)} dir="auto" /></label>
        <button className="primary">{t('patrol.addCheckpoint')}</button>
      </form>
    </section>
  )
}

export default function PatrolsPage(): ReactNode {
  const { t } = useTranslation()
  const { toast, user } = useApp()
  const [round, setRound] = useState<PatrolRoundDetail | null>(null)
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [recent, setRecent] = useState<PatrolRound[]>([])
  const [scanning, setScanning] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const lastCode = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const lang = currentLang()

  const load = useCallback(async () => {
    const [r, cps, list] = await Promise.all([
      window.api.patrols.current(), window.api.patrols.checkpoints(false),
      window.api.patrols.list({ from: todayStr(new Date(Date.now() - 6 * 86400000)), to: todayStr(), text: '' })
    ])
    setRound(r)
    setCheckpoints(cps)
    setRecent(list.filter((x) => x.endedAt))
    setLoaded(true)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const run = async (fn: () => Promise<void>): Promise<void> => {
    try {
      await fn()
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  const check = (checkpointId: number, status: 'ok' | 'issue', note: string, method: 'manual' | 'qr'): Promise<void> => run(async () => {
    if (!round) return
    setRound(await window.api.patrols.check(round.id, checkpointId, status, note, method))
  })

  const onCode = useCallback(async (text: string) => {
    // the same label stays in front of the camera for a while: ignore repeats
    if (text === lastCode.current.code && Date.now() - lastCode.current.at < 4000) return
    lastCode.current = { code: text, at: Date.now() }
    const cp = await window.api.patrols.findByCode(text)
    if (!cp) return toast(t('patrol.notFound'), 'error')
    await check(cp.id, 'ok', '', 'qr')
    toast(t('patrol.found', { name: cp.name }))
  }, [round])

  if (!loaded) return <p>{t('common.loading')}</p>

  const missed = round ? round.checks.filter((c) => !c.status).length : 0

  return (
    <div className="split-page">
      <section className="card">
        <h1>{t('patrol.title')}</h1>
        {checkpoints.length === 0 && !round ? <p className="empty">{t('patrol.noCheckpoints')}</p> : !round ? (
          <button type="button" className="primary big wide-btn" onClick={() => run(async () => setRound(await window.api.patrols.start()))}>
            <Icon name="shield" /> {t('patrol.start')}
          </button>
        ) : (
          <>
            <div className="section-head">
              <div>
                <h2>{t('patrol.current')}</h2>
                <span className="muted">{t('patrol.startedAt', { time: formatTime(round.startedAt, lang) })}</span>
              </div>
              <button type="button" onClick={() => setScanning(!scanning)}><Icon name="scan" /> {t('patrol.scan')}</button>
            </div>
            <div className="progress" aria-label={t('patrol.progress', { done: round.done, total: round.total })}>
              <div style={{ width: `${round.total ? (100 * round.done) / round.total : 0}%` }} />
            </div>
            <p className="muted">{t('patrol.progress', { done: round.done, total: round.total })}{round.issues > 0 && ` · ${t('patrol.issues')}: ${round.issues}`}</p>
            {scanning && <QrScanner onCode={onCode} onClose={() => setScanning(false)} hint={t('patrol.scanHint')} prefix="SECREG-CP:" />}
            <ul className="check-list">
              {round.checks.map((c) => <CheckRow key={c.checkpointId} c={c} onCheck={(s, n) => check(c.checkpointId, s, n, 'manual')} />)}
            </ul>
            <div className="actions">
              <button type="button" className="primary big" onClick={() => setFinishing(true)}>{t('patrol.finish')}</button>
            </div>
          </>
        )}
      </section>

      <div className="stack">
        <section className="card">
          <h2>{t('patrol.recent')}</h2>
          {recent.length === 0 ? <p className="empty">{t('patrol.none')}</p> : (
            <ul className="inside-list">
              {recent.map((r) => (
                <li key={r.id}>
                  <div className="who-col"><strong>{r.guard}</strong><span className="muted">{formatDateTime(r.startedAt, lang)}</span></div>
                  <div className="meta-col">
                    <span className={`badge-chip ${r.done < r.total ? 'warn' : ''}`}>{r.done} / {r.total}</span>
                    {r.issues > 0 && <span className="tag sev-high">{t('patrol.issues')}: {r.issues}</span>}
                  </div>
                  <span />
                </li>
              ))}
            </ul>
          )}
        </section>
        {user.role === 'admin' && <CheckpointAdmin onChanged={load} />}
      </div>

      {finishing && round && (
        <PromptDialog
          title={t('patrol.finish')}
          summary={missed > 0 ? <span className="banner warn">{t('patrol.missed', { count: missed })}</span> : <span>{t('patrol.progress', { done: round.done, total: round.total })}</span>}
          label={t('patrol.note')}
          confirmLabel={t('patrol.finish')}
          multiline
          onClose={() => setFinishing(false)}
          onConfirm={async (note) => {
            await window.api.patrols.finish(round.id, note)
            toast(t('patrol.finished'))
            setFinishing(false)
            setScanning(false)
            load()
          }}
        />
      )}
    </div>
  )
}
