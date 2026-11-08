import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { RemoteStatus } from '@shared/types'
import { useApp } from '../App'
import { errorText } from '../util'

/**
 * Administration → System: the deanship's access over the faculty network. Off until switched on here, with the addresses of the
 * PCs allowed to connect (the dean's); only an account of the level "Dean" can sign in there.
 */
export default function RemoteAccessCard(): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [status, setStatus] = useState<RemoteStatus | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [port, setPort] = useState('8443')
  const [ips, setIps] = useState('')

  const load = useCallback(async () => {
    try {
      const s = await window.api.remote.get()
      setStatus(s)
      setEnabled(s.enabled)
      setPort(String(s.port))
      setIps(s.allowedIps.join('\n'))
    } catch (e) { toast(errorText(e, t), 'error') }
  }, [toast, t])
  useEffect(() => { void load() }, [load])

  const save = async (): Promise<void> => {
    try {
      await window.api.remote.set({ enabled, port: Number(port), allowedIps: ips.split(/[\s,;]+/).filter(Boolean) })
      toast(t('remote.saved'))
      // the server takes a moment to start (or stop)
      setTimeout(() => { void load() }, 2500)
    } catch (e) { toast(errorText(e, t), 'error') }
  }

  return (
    <section className="card">
      <h2>{t('remote.title')}</h2>
      <p className="hint">{t('remote.intro')}</p>
      {status && (
        <div className={`banner ${status.running ? 'ok' : status.error ? 'warn' : ''}`}>
          {status.running ? t('remote.running', { urls: status.urls.join('  ') }) : status.error ? t('remote.failed', { error: status.error }) : t('remote.off')}
        </div>
      )}
      <label className="check"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> {t('remote.enable')}</label>
      <div className="actions start">
        <label>{t('remote.port')} <input type="number" min={1024} max={65535} value={port} onChange={(e) => setPort(e.target.value)} style={{ width: '7rem' }} /></label>
      </div>
      <label>{t('remote.allowed')}
        <textarea rows={3} value={ips} placeholder="192.168.1.20" onChange={(e) => setIps(e.target.value)} dir="ltr" />
      </label>
      <p className="hint">{t('remote.help')}</p>
      <div className="actions start">
        <button type="button" className="primary" onClick={save}>{t('common.save')}</button>
      </div>
    </section>
  )
}
