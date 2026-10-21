import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../App'
import Icon, { type IconName } from '../components/Icon'
import RegisterBuilder from '../components/RegisterBuilder'
import AuditLog from '../components/AuditLog'
import SystemPanel from '../components/SystemPanel'
import { UserSettings } from './SettingsPage'

type Tab = 'accounts' | 'registers' | 'audit' | 'system'
const TABS: { id: Tab; icon: IconName }[] = [
  { id: 'accounts', icon: 'users' },
  { id: 'registers', icon: 'book' },
  { id: 'audit', icon: 'eye' },
  { id: 'system', icon: 'gear' }
]

/** Where administrators land: accounts, registers and the audit trail; the other settings stay one click away. */
export default function AdminPage(): ReactNode {
  const { t } = useTranslation()
  const { go } = useApp()
  const [tab, setTab] = useState<Tab>('accounts')
  return (
    <div className="admin-page">
      <div className="section-head">
        <h1>{t('admin.title')}</h1>
        <button type="button" onClick={() => go('settings')}><Icon name="gear" /> {t('admin.settings')}</button>
      </div>
      <div className="seg admin-tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'seg-btn on' : 'seg-btn'} onClick={() => setTab(x.id)}>
            <Icon name={x.icon} size={18} /> {t(`admin.${x.id}`)}
          </button>
        ))}
      </div>
      {tab === 'accounts' && (
        <>
          <p className="hint">{t('admin.accountsIntro')}</p>
          <UserSettings />
        </>
      )}
      {tab === 'registers' && <RegisterBuilder />}
      {tab === 'audit' && <AuditLog />}
      {tab === 'system' && <SystemPanel />}
    </div>
  )
}
