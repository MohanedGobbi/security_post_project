import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { SyncStatus } from '@shared/types'
import { formatDateTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import Icon from './Icon'
import { errorText } from '../util'

/** Administrator card: link this post to the organisation's server (optional). */
export default function ServerSettings(): ReactNode {
  const { t } = useTranslation()
  const { toast, siteName } = useApp()
  const [s, setS] = useState<SyncStatus | null>(null)
  const [f, setF] = useState({ url: '', code: '', name: '' })
  const [busy, setBusy] = useState(false)
  const lang = currentLang()

  useEffect(() => {
    window.api.sync.status().then(setS)
  }, [])

  const run = async (fn: () => Promise<SyncStatus | void>, ok?: string): Promise<void> => {
    setBusy(true)
    try {
      const r = await fn()
      setS(r ?? (await window.api.sync.status()))
      if (ok) toast(ok)
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  const connect = (e: FormEvent): void => {
    e.preventDefault()
    void run(() => window.api.sync.connect(f.url, f.code, f.name || siteName), t('sync.connected'))
  }

  if (!s) return null
  return (
    <section className="card">
      <h2><Icon name="cloud" /> {t('sync.title')}</h2>
      <p className="hint">{t('sync.intro')}</p>
      {s.configured ? (
        <>
          <dl className="detail-grid">
            <div><dt>{t('sync.server')}</dt><dd className="mono">{s.url}</dd></div>
            <div><dt>{t('sync.site')}</dt><dd>{s.siteName}</dd></div>
            <div><dt>{t('sync.post')}</dt><dd>{s.deviceName}</dd></div>
            <div><dt>{t('sync.lastSync')}</dt><dd>{s.lastSync ? formatDateTime(s.lastSync, lang) : t('sync.never')}</dd></div>
          </dl>
          <div className={`banner ${s.online ? 'ok' : 'warn'}`}>
            {s.online ? t('sync.online') : t('sync.offline')}{s.lastError && !s.online && ` · ${t(s.lastError)}`}
          </div>
          <p className="hint">{t('sync.privacy')}</p>
          <div className="actions">
            <button type="button" disabled={busy} onClick={() => run(() => window.api.sync.disconnect(), t('sync.disconnected'))}>{t('sync.disconnect')}</button>
            <button type="button" className="primary" disabled={busy} onClick={() => run(() => window.api.sync.now())}>{t('sync.now')}</button>
          </div>
        </>
      ) : (
        <form onSubmit={connect}>
          <label>{t('sync.url')}<input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} dir="ltr" placeholder="https://securite.example.com" required /></label>
          <div className="row2">
            <label>{t('sync.code')}<input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} dir="ltr" className="mono" maxLength={12} required /></label>
            <label>{t('sync.postName')}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} dir="auto" placeholder={siteName} /></label>
          </div>
          <p className="hint">{t('sync.codeHint')}</p>
          <div className="actions"><button className="primary" disabled={busy}>{busy ? t('common.loading') : t('sync.connect')}</button></div>
        </form>
      )}
    </section>
  )
}
