import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { BackupInfo, SafetyCopy } from '@shared/types'
import { formatDateTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import Icon from './Icon'
import SecureDialog from './SecureDialog'
import { errorText } from '../util'

type Action = null | 'backup' | 'restoreFile' | { copy: SafetyCopy } | 'erase' | 'reset'

const mb = (n: number): string => `${(n / 1048576).toFixed(1)} MB`

/** Administration → System: backups, restoring, erasing and starting over. Everything here asks the administrator's PIN where it cannot be undone. */
export default function SystemPanel(): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const lang = currentLang()
  const [info, setInfo] = useState<BackupInfo | null>(null)
  const [action, setAction] = useState<Action>(null)
  const [withStudents, setWithStudents] = useState(false)

  const load = useCallback(() => {
    window.api.system.info().then(setInfo).catch((e) => toast(errorText(e, t), 'error'))
  }, [toast, t])
  useEffect(load, [load])
  const close = (): void => { setAction(null); load() }

  const stale = !info?.lastBackup || Date.now() - Date.parse(info.lastBackup) > 7 * 86400000

  return (
    <div className="stack">
      <section className="card">
        <h2>{t('system.backupTitle')}</h2>
        <p className="hint">{t('system.backupIntro')}</p>
        {info && <div className={`banner ${stale ? 'warn' : 'ok'}`}>
          {info.lastBackup ? t('system.lastBackup', { date: formatDateTime(info.lastBackup, lang) }) : t('system.neverBackedUp')}
        </div>}
        <div className="actions start">
          <button type="button" className="primary" onClick={() => setAction('backup')}><Icon name="cloud" /> {t('system.backupNow')}</button>
          <button type="button" onClick={() => setAction('restoreFile')}><Icon name="upload" /> {t('system.restoreFile')}</button>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>{t('system.copiesTitle')}</h2>
          <button type="button" onClick={() => window.api.system.openFolder()}>{t('system.openFolder')}</button>
        </div>
        <p className="hint">{t('system.copiesIntro')}</p>
        {info && info.copies.length === 0 ? <p className="empty">{t('system.noCopies')}</p> : (
          <table className="log-table">
            <thead><tr><th>{t('system.when')}</th><th>{t('system.kindTitle')}</th><th>{t('system.size')}</th><th /></tr></thead>
            <tbody>
              {info?.copies.map((c) => (
                <tr key={c.name}>
                  <td>{formatDateTime(c.time, lang)}</td>
                  <td>{t(`system.kind.${c.kind}`, { defaultValue: c.kind })}</td>
                  <td>{mb(c.bytes)}</td>
                  <td className="row-actions"><button type="button" onClick={() => setAction({ copy: c })}>{t('system.restore')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>{t('system.dangerTitle')}</h2>
        <p className="hint">{t('system.dangerIntro')}</p>
        <div className="danger-row">
          <div><strong>{t('system.eraseTitle')}</strong><p className="hint">{t('system.eraseHelp')}</p>
            <label className="check"><input type="checkbox" checked={withStudents} onChange={(e) => setWithStudents(e.target.checked)} /> {t('system.eraseStudents')}</label></div>
          <button type="button" onClick={() => setAction('erase')}>{t('system.erase')}</button>
        </div>
        <div className="danger-row">
          <div><strong>{t('system.resetTitle')}</strong><p className="hint">{t('system.resetHelp')}</p></div>
          <button type="button" onClick={() => setAction('reset')}>{t('system.reset')}</button>
        </div>
        <div className="danger-row">
          <div><strong>{t('system.restartTitle')}</strong><p className="hint">{t('system.restartHelp')}</p></div>
          <button type="button" onClick={() => window.api.system.restart()}>{t('system.restart')}</button>
        </div>
      </section>

      {action === 'backup' && (
        <SecureDialog title={t('system.backupNow')} confirmLabel={t('system.backupNow')} password="choose" onCancel={close}
          onConfirm={async ({ password }) => {
            const path = await window.api.system.backup(password)
            if (path) toast(t('export.saved', { path }))
            close()
          }}>
          <p className="hint">{t('system.backupDialog')}</p>
        </SecureDialog>
      )}
      {action === 'restoreFile' && (
        <SecureDialog title={t('system.restoreFile')} confirmLabel={t('system.restoreNow')} danger needPin password="enter" onCancel={close}
          onConfirm={async ({ pin, password }) => {
            const done = await window.api.system.restoreFile(password, pin)
            if (done) toast(t('system.restarting'))
            else close()
          }}>
          <div className="banner warn">{t('system.restoreWarn')}</div>
        </SecureDialog>
      )}
      {action && typeof action === 'object' && (
        <SecureDialog title={t('system.restore')} confirmLabel={t('system.restoreNow')} danger needPin onCancel={close}
          onConfirm={async ({ pin }) => {
            await window.api.system.restoreCopy(action.copy.name, pin)
            toast(t('system.restarting'))
          }}>
          <div className="banner warn">{t('system.restoreWarn')}</div>
          <p>{formatDateTime(action.copy.time, lang)} · {t(`system.kind.${action.copy.kind}`, { defaultValue: action.copy.kind })}</p>
        </SecureDialog>
      )}
      {action === 'erase' && (
        <SecureDialog title={t('system.eraseTitle')} confirmLabel={t('system.erase')} danger needPin confirmWord={t('system.word')} onCancel={close}
          onConfirm={async ({ pin }) => {
            await window.api.system.erase(pin, withStudents)
            toast(t('system.erased'))
            close()
          }}>
          <div className="banner error">{t('system.eraseWarn')}</div>
        </SecureDialog>
      )}
      {action === 'reset' && (
        <SecureDialog title={t('system.resetTitle')} confirmLabel={t('system.reset')} danger needPin confirmWord={t('system.word')} onCancel={close}
          onConfirm={async ({ pin }) => {
            await window.api.system.factoryReset(pin)
            toast(t('system.restarting'))
          }}>
          <div className="banner error">{t('system.resetWarn')}</div>
        </SecureDialog>
      )}
    </div>
  )
}
