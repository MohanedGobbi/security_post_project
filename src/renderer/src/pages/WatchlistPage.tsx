import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { WatchLevel, WatchRow } from '@shared/types'
import { formatDateTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import { errorText } from '../util'

const EMPTY = { name: '', idNumber: '', plate: '', reason: '', level: 'deny' as WatchLevel }

export default function WatchlistPage(): ReactNode {
  const { t } = useTranslation()
  const { toast, user } = useApp()
  const [rows, setRows] = useState<WatchRow[]>([])
  const [f, setF] = useState(EMPTY)
  const isAdmin = user.role === 'admin'
  const lang = currentLang()

  const load = useCallback(() => {
    window.api.watchlist.list().then(setRows)
  }, [])
  useEffect(load, [load])

  const set = (k: keyof typeof EMPTY, v: string): void => setF((cur) => ({ ...cur, [k]: v }))

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
      await window.api.watchlist.add(f)
      setF(EMPTY)
    }, t('watch.saved'))
  }

  return (
    <div className="page-card">
      <section className="card">
        <h1>{t('watch.title')}</h1>
        <p className="muted">{t('watch.intro')}</p>
        {rows.length === 0 ? <p className="empty">{t('watch.none')}</p> : (
          <div className="table-wrap">
            <table className="log-table static">
              <thead>
                <tr>
                  <th>{t('watch.name')}</th><th>{t('watch.idNumber')}</th><th>{t('watch.plate')}</th><th>{t('watch.reason')}</th>
                  <th>{t('watch.level')}</th><th>{t('watch.addedBy')}</th>{isAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.active ? '' : 'disabled'}>
                    <td dir="auto"><strong>{r.name}</strong></td>
                    <td className="mono" dir="ltr">{r.idNumber}</td>
                    <td>{r.plate && <span className="plate">{r.plate}</span>}</td>
                    <td dir="auto">{r.reason}</td>
                    <td><span className={`tag level-${r.level}`}>{t(`watch.levels.${r.level}`)}</span></td>
                    <td>
                      {r.source === 'server'
                        ? <span className="tag kind-shift_start">{t('watch.fromServer')}</span>
                        : <>{r.addedBy}<div className="muted">{formatDateTime(r.createdAt, lang)}</div></>}
                    </td>
                    {isAdmin && (
                      <td className="row-actions">
                        {r.source === 'local' && (
                          <button type="button" onClick={() => run(() => window.api.watchlist.setActive(r.id, !r.active))}>
                            {t(r.active ? 'watch.disable' : 'watch.enable')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isAdmin ? (
        <form className="card" onSubmit={add}>
          <h2>{t('watch.add')}</h2>
          <p className="hint">{t('watch.hint')}</p>
          <div className="row3">
            <label>{t('watch.name')}<input value={f.name} onChange={(e) => set('name', e.target.value)} dir="auto" /></label>
            <label>{t('watch.idNumber')}<input value={f.idNumber} onChange={(e) => set('idNumber', e.target.value)} dir="ltr" className="mono" /></label>
            <label>{t('watch.plate')}<input value={f.plate} onChange={(e) => set('plate', e.target.value)} dir="ltr" /></label>
          </div>
          <label className="req">{t('watch.reason')}<input value={f.reason} onChange={(e) => set('reason', e.target.value)} dir="auto" /></label>
          <div className="seg" role="radiogroup" aria-label={t('watch.level')}>
            {(['deny', 'alert'] as const).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={f.level === l} className={`seg-btn level-${l} ${f.level === l ? 'on' : ''}`}
                onClick={() => set('level', l)}>{t(`watch.levels.${l}`)}</button>
            ))}
          </div>
          <div className="actions"><button className="primary">{t('watch.add')}</button></div>
        </form>
      ) : <p className="hint">{t('watch.adminOnly')}</p>}
    </div>
  )
}
