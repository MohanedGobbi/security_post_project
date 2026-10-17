import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@shared/i18n'
import { currentLang } from '@desktop/i18n'
import { errText, get, patch, post } from '../api'
import { useDash } from '../App'
import type { WatchEntry } from '../types'

const EMPTY = { name: '', idNumber: '', plate: '', reason: '', level: 'deny' as 'deny' | 'alert' }

/** Organisation-wide watchlist, sent to every post at the next sync */
export default function WatchlistPage(): ReactNode {
  const { t } = useTranslation()
  const { toast } = useDash()
  const lang = currentLang()
  const [rows, setRows] = useState<WatchEntry[]>([])
  const [f, setF] = useState(EMPTY)

  const load = useCallback(() => {
    get<WatchEntry[]>('/api/watchlist').then(setRows)
  }, [])
  useEffect(load, [load])

  const run = async (fn: () => Promise<unknown>, ok?: string): Promise<void> => {
    try {
      await fn()
      if (ok) toast(ok)
      load()
    } catch (e) {
      toast(errText(e, t), 'error')
    }
  }

  const add = (e: FormEvent): void => {
    e.preventDefault()
    void run(async () => {
      await post('/api/watchlist', f)
      setF(EMPTY)
    }, t('watch.saved'))
  }

  return (
    <div className="page-card wide">
      <section className="card">
        <h1>{t('watch.title')}</h1>
        <p className="muted">{t('dash.watchIntro')}</p>
        {rows.length === 0 ? <p className="empty">{t('watch.none')}</p> : (
          <div className="table-wrap">
            <table className="log-table static">
              <thead><tr><th>{t('watch.name')}</th><th>{t('watch.idNumber')}</th><th>{t('watch.plate')}</th><th>{t('watch.reason')}</th><th>{t('watch.level')}</th><th>{t('watch.addedBy')}</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.active ? '' : 'disabled'}>
                    <td dir="auto"><strong>{r.name}</strong></td>
                    <td className="mono" dir="ltr">{r.idNumber}</td>
                    <td>{r.plate && <span className="plate">{r.plate}</span>}</td>
                    <td dir="auto">{r.reason}</td>
                    <td><span className={`tag level-${r.level}`}>{t(`watch.levels.${r.level}`)}</span></td>
                    <td>{r.createdBy}<div className="muted">{formatDateTime(r.createdAt, lang)}</div></td>
                    <td className="row-actions">
                      <button type="button" onClick={() => run(() => patch(`/api/watchlist/${r.id}`, { active: !r.active }))}>{t(r.active ? 'watch.disable' : 'watch.enable')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <form className="card" onSubmit={add}>
        <h2>{t('watch.add')}</h2>
        <p className="hint">{t('watch.hint')}</p>
        <div className="row3">
          <label>{t('watch.name')}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} dir="auto" /></label>
          <label>{t('watch.idNumber')}<input value={f.idNumber} onChange={(e) => setF({ ...f, idNumber: e.target.value })} dir="ltr" className="mono" /></label>
          <label>{t('watch.plate')}<input value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} dir="ltr" /></label>
        </div>
        <label className="req">{t('watch.reason')}<input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} dir="auto" /></label>
        <div className="seg" role="radiogroup" aria-label={t('watch.level')}>
          {(['deny', 'alert'] as const).map((l) => (
            <button key={l} type="button" role="radio" aria-checked={f.level === l} className={`seg-btn level-${l} ${f.level === l ? 'on' : ''}`}
              onClick={() => setF({ ...f, level: l })}>{t(`watch.levels.${l}`)}</button>
          ))}
        </div>
        <div className="actions"><button className="primary">{t('watch.add')}</button></div>
      </form>
    </div>
  )
}
