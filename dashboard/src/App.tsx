import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Lang } from '@shared/types'
import i18n from '@desktop/i18n'
import { LANGS } from '@shared/i18n'
import Icon, { type IconName } from '@desktop/components/Icon'
import { errText, get, patch, post } from './api'
import type { Me, Role } from './types'
import OverviewPage from './pages/OverviewPage'
import RecordsPage from './pages/RecordsPage'
import ExpectedPage from './pages/ExpectedPage'
import SitesPage from './pages/SitesPage'
import WatchlistPage from './pages/WatchlistPage'
import UsersPage from './pages/UsersPage'
import AccountPage from './pages/AccountPage'

export type Page = 'overview' | 'records' | 'expected' | 'sites' | 'watchlist' | 'users' | 'account'

interface Ctx { me: Me; toast(text: string, kind?: 'ok' | 'error'): void; go(p: Page): void }
const AppCtx = createContext<Ctx | null>(null)
export const useDash = (): Ctx => useContext(AppCtx) as Ctx

const NAV: { page: Page; key: string; icon: IconName; roles: Role[] }[] = [
  { page: 'overview', key: 'dash.nav.overview', icon: 'home', roles: ['owner', 'supervisor'] },
  { page: 'records', key: 'dash.nav.records', icon: 'list', roles: ['owner', 'supervisor'] },
  { page: 'expected', key: 'dash.nav.expected', icon: 'calendar', roles: ['owner', 'supervisor', 'host'] },
  { page: 'sites', key: 'dash.nav.sites', icon: 'shield', roles: ['owner', 'supervisor'] },
  { page: 'watchlist', key: 'dash.nav.watchlist', icon: 'eye', roles: ['owner', 'supervisor'] },
  { page: 'users', key: 'dash.nav.users', icon: 'user', roles: ['owner'] },
  { page: 'account', key: 'dash.nav.account', icon: 'gear', roles: ['owner', 'supervisor', 'host'] }
]

function LangSwitch({ onChange }: { onChange?(l: Lang): void }): ReactNode {
  const { t, i18n: inst } = useTranslation()
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l} type="button" className={inst.language === l ? 'active' : ''} lang={l}
          onClick={() => { i18n.changeLanguage(l); onChange?.(l) }}>{t(`lang.${l}`)}</button>
      ))}
    </div>
  )
}

/** First start (setup code from the server console) or sign-in */
function AuthScreen({ setup, onDone, toast }: { setup: boolean; onDone(me: Me): void; toast(t: string, k?: 'ok' | 'error'): void }): ReactNode {
  const { t } = useTranslation()
  const [f, setF] = useState({ token: '', email: '', name: '', password: '', siteName: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    try {
      const me = setup
        ? await post<Me>('/api/setup', { ...f, language: i18n.language })
        : await post<Me>('/api/login', { email: f.email, password: f.password })
      onDone(me)
    } catch (err) {
      toast(errText(err, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-screen">
      <form className="card auth-card" onSubmit={submit}>
        <LangSwitch />
        <div className="login-head">
          <span className="brand-mark big"><Icon name="shield" size={30} /></span>
          <div><h1>{t('app.title')}</h1><p className="muted">{t('dash.subtitle')}</p></div>
        </div>
        {setup && (
          <>
            <h2>{t('dash.setup.title')}</h2>
            <p className="hint">{t('dash.setup.intro')}</p>
            <label>{t('dash.setup.token')}<input value={f.token} onChange={set('token')} className="mono" dir="ltr" required autoFocus /></label>
            <label>{t('dash.user.name')}<input value={f.name} onChange={set('name')} dir="auto" required /></label>
            <label>{t('dash.setup.siteName')}<input value={f.siteName} onChange={set('siteName')} dir="auto" /></label>
          </>
        )}
        <label>{t('dash.user.email')}<input type="email" value={f.email} onChange={set('email')} dir="ltr" required autoFocus={!setup} autoComplete="username" /></label>
        <label>{t('dash.user.password')}<input type="password" value={f.password} onChange={set('password')} required minLength={setup ? 8 : undefined}
          autoComplete={setup ? 'new-password' : 'current-password'} /></label>
        <button className="primary big" disabled={busy}>{t(setup ? 'dash.setup.create' : 'dash.login')}</button>
      </form>
    </div>
  )
}

export default function App(): ReactNode {
  const { t } = useTranslation()
  const [state, setState] = useState<'loading' | 'setup' | 'login' | 'ready'>('loading')
  const [me, setMe] = useState<Me | null>(null)
  const [page, setPage] = useState<Page>('overview')
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: 'ok' | 'error' }[]>([])

  const toast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts, { id, text, kind }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])

  const enter = (u: Me): void => {
    setMe(u)
    i18n.changeLanguage(u.language)
    setPage(u.role === 'host' ? 'expected' : 'overview')
    setState('ready')
  }

  useEffect(() => {
    get<Me>('/api/me').then(enter).catch(async () => {
      const s = await get<{ needsSetup: boolean }>('/api/setup')
      setState(s.needsSetup ? 'setup' : 'login')
    })
  }, [])

  const logout = async (): Promise<void> => {
    await post('/api/logout')
    setMe(null)
    setState('login')
  }

  const toastLayer = <div className="toasts" aria-live="polite">{toasts.map((x) => <div key={x.id} className={`toast ${x.kind}`}>{x.text}</div>)}</div>

  if (state === 'loading') return <div className="center-screen">{t('common.loading')}</div>
  if (state !== 'ready' || !me) return <><AuthScreen setup={state === 'setup'} onDone={enter} toast={toast} />{toastLayer}</>

  const nav = NAV.filter((n) => n.roles.includes(me.role))
  return (
    <AppCtx.Provider value={{ me, toast, go: setPage }}>
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark"><Icon name="shield" size={22} /></span>
            <div><strong>{t('app.title')}</strong><span>{t('dash.subtitle')}</span></div>
          </div>
          <div className="topbar-end">
            <LangSwitch onChange={(l) => { void patch('/api/me', { language: l }) }} />
            <div className="who">
              <span>{me.name}</span>
              <button type="button" className="link" onClick={logout}>{t('nav.logout')}</button>
            </div>
          </div>
        </header>
        <div className="body">
          <nav className="sidebar">
            {nav.map((n) => (
              <button key={n.page} type="button" className={`${page === n.page ? 'active' : ''} ${n.page === 'account' ? 'nav-bottom' : ''}`} onClick={() => setPage(n.page)}>
                <Icon name={n.icon} /> <span>{t(n.key)}</span>
              </button>
            ))}
          </nav>
          <main className="content">
            {page === 'overview' && <OverviewPage />}
            {page === 'records' && <RecordsPage />}
            {page === 'expected' && <ExpectedPage />}
            {page === 'sites' && <SitesPage />}
            {page === 'watchlist' && <WatchlistPage />}
            {page === 'users' && <UsersPage />}
            {page === 'account' && <AccountPage />}
          </main>
        </div>
      </div>
      {toastLayer}
    </AppCtx.Provider>
  )
}
