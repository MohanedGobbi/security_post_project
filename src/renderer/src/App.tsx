import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGS } from '@shared/i18n'
import type { AlertItem, ExpectedVisitor, Features, Lang, Module, SyncStatus, User } from '@shared/types'
import { formatDateTime } from '@shared/i18n'
import { ALL_ON } from '@shared/features'
import i18n from './i18n'
import { appTitle, BRAND } from './brand'
import LoginPage from './pages/LoginPage'
import ShiftStartPage from './pages/ShiftStartPage'
import HomePage from './pages/HomePage'
import VisitorInPage from './pages/VisitorInPage'
import CheckOutPage from './pages/CheckOutPage'
import VehiclesPage from './pages/VehiclesPage'
import DeliveriesPage from './pages/DeliveriesPage'
import IncidentsPage from './pages/IncidentsPage'
import NotesPage from './pages/NotesPage'
import RegistersPage from './pages/RegistersPage'
import AdminPage from './pages/AdminPage'
import LogPage from './pages/LogPage'
import WatchlistPage from './pages/WatchlistPage'
import PatrolsPage from './pages/PatrolsPage'
import KeysPage from './pages/KeysPage'
import ExpectedPage from './pages/ExpectedPage'
import SettingsPage from './pages/SettingsPage'
import EndShiftDialog from './components/EndShiftDialog'
import Icon, { type IconName } from './components/Icon'
import BrandMark from './components/BrandMark'

export type Page = 'home' | 'in' | 'out' | 'expected' | 'vehicles' | 'deliveries' | 'incidents' | 'patrols' | 'keys' | 'notes' | 'registers' | 'admin' | 'log' | 'watchlist' | 'settings'

interface Toast { id: number; text: string; kind: 'ok' | 'error' }

interface AppCtx {
  user: User
  siteName: string
  features: Features
  refreshFeatures(): Promise<void>
  alerts: AlertItem[]
  refreshAlerts(): void
  go(page: Page): void
  toast(text: string, kind?: 'ok' | 'error'): void
  /** opens Visitor IN pre-filled with an expected visitor */
  checkInExpected(e: ExpectedVisitor): void
  /** read once by Visitor IN */
  takeExpected(): ExpectedVisitor | null
  /** register shown on the Registers page */
  registerId: number | null
  /** opens one register (null = the list of registers) */
  openRegister(id: number | null): void
}

const Ctx = createContext<AppCtx | null>(null)
export const useApp = (): AppCtx => useContext(Ctx) as AppCtx

/** Pages that belong to an optional module */
const PAGE_MODULE: Partial<Record<Page, Module>> = {
  vehicles: 'vehicles', deliveries: 'deliveries', incidents: 'incidents', patrols: 'patrols', keys: 'keys', notes: 'notes', watchlist: 'watchlist',
  expected: 'preregistration'
}

export const pageOn = (page: Page, f: Features): boolean => {
  const m = PAGE_MODULE[page]
  return !m || f.modules[m]
}

const NAV: { page: Page; key: string; icon: IconName; shortcut?: string }[] = [
  { page: 'home', key: 'nav.home', icon: 'home', shortcut: 'F1' },
  { page: 'in', key: 'nav.visitorIn', icon: 'enter', shortcut: 'F2' },
  { page: 'out', key: 'nav.visitorOut', icon: 'exit', shortcut: 'F3' },
  { page: 'expected', key: 'nav.expected', icon: 'calendar', shortcut: 'F12' },
  { page: 'vehicles', key: 'nav.vehicles', icon: 'car', shortcut: 'F4' },
  { page: 'deliveries', key: 'nav.deliveries', icon: 'box', shortcut: 'F5' },
  { page: 'incidents', key: 'nav.incidents', icon: 'alert', shortcut: 'F6' },
  { page: 'patrols', key: 'nav.patrols', icon: 'shield', shortcut: 'F10' },
  { page: 'keys', key: 'nav.keys', icon: 'key', shortcut: 'F11' },
  { page: 'notes', key: 'nav.notes', icon: 'note', shortcut: 'F7' },
  { page: 'registers', key: 'nav.registers', icon: 'book' },
  { page: 'admin', key: 'nav.admin', icon: 'users' },
  { page: 'log', key: 'nav.log', icon: 'list', shortcut: 'F8' },
  { page: 'watchlist', key: 'nav.watchlist', icon: 'eye' },
  { page: 'settings', key: 'nav.settings', icon: 'gear', shortcut: 'F9' }
]

function Clock(): ReactNode {
  const { i18n: inst } = useTranslation()
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])
  const tag = inst.language === 'ar' ? 'ar-u-nu-latn' : inst.language === 'fr' ? 'fr-FR' : 'en-GB'
  return (
    <div className="clock">
      <strong>{now.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' })}</strong>
      <span>{now.toLocaleDateString(tag, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
    </div>
  )
}

export function LangSwitch({ onChange }: { onChange?: (l: Lang) => void }): ReactNode {
  const { t, i18n: inst } = useTranslation()
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l} type="button" className={inst.language === l ? 'active' : ''} lang={l}
          onClick={() => { i18n.changeLanguage(l); onChange?.(l) }}>
          {t(`lang.${l}`)}
        </button>
      ))}
    </div>
  )
}

export default function App(): ReactNode {
  const { t } = useTranslation()
  const [state, setState] = useState<'loading' | 'login' | 'shift' | 'ready'>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [siteName, setSiteName] = useState('')
  const [page, setPage] = useState<Page>('home')
  /** the register open on the Registers page (null = its list of tiles) */
  const [registerId, setRegisterId] = useState<number | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [ending, setEnding] = useState(false)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [features, setFeatures] = useState<Features>(ALL_ON)
  const [sync, setSync] = useState<SyncStatus | null>(null)
  const pendingExpected = useRef<ExpectedVisitor | null>(null)

  // connection to the organisation's server, when there is one
  useEffect(() => {
    if (state !== 'ready') return
    const load = (): void => { window.api.sync.status().then(setSync).catch(() => undefined) }
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [state, page])

  const refreshFeatures = useCallback(async () => {
    setFeatures(await window.api.settings.getFeatures())
  }, [])

  const refreshAlerts = useCallback(() => {
    window.api.alerts.list().then(setAlerts).catch(() => undefined)
  }, [])

  // alerts are recomputed every minute and whenever the page changes
  useEffect(() => {
    if (state !== 'ready') return
    refreshAlerts()
    const timer = setInterval(refreshAlerts, 60000)
    return () => clearInterval(timer)
  }, [state, page, refreshAlerts])

  const toast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts, { id, text, kind }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])

  /** After login: a guard without an open shift first reads the handover and starts one (when shifts are used). */
  const enter = useCallback(async (u: User) => {
    setUser(u)
    const f = await window.api.settings.getFeatures()
    setFeatures(f)
    setPage('home')
    // organisation builds (PIN-only login): administrators go straight to administration, without a guard shift
    if (u.role === 'admin') {
      setPage('admin')
      return setState('ready')
    }
    if (!f.modules.shifts) return setState('ready')
    const s = await window.api.shifts.state()
    setState(s.mine ? 'ready' : 'shift')
  }, [])

  useEffect(() => {
    window.api.auth.status().then((s) => {
      setSiteName(s.siteName)
      setFeatures(s.features)
      if (s.user) enter(s.user)
      else setState('login')
    })
  }, [enter])

  const onLoggedIn = (u: User): void => {
    i18n.changeLanguage(u.language)
    window.api.auth.status().then((s) => setSiteName(s.siteName))
    enter(u)
  }

  const logout = async (): Promise<void> => {
    await window.api.auth.logout()
    setUser(null)
    setEnding(false)
    setState('login')
  }

  // the Administration page is for administrators only
  const nav = NAV.filter((n) => pageOn(n.page, features) && (n.page !== 'admin' || user?.role === 'admin'))
  // the first of the bottom items (watchlist, settings) is pushed to the bottom of the sidebar
  const bottomPage = nav.find((n) => n.page === 'watchlist' || n.page === 'settings')?.page

  // a page that was just switched off in Settings → Features
  useEffect(() => {
    if (!pageOn(page, features)) setPage('home')
  }, [page, features])

  // keyboard shortcuts for the desk: F1..F11, Esc goes home
  useEffect(() => {
    if (state !== 'ready') return
    const onKey = (e: KeyboardEvent): void => {
      const hit = NAV.find((n) => n.shortcut === e.key && pageOn(n.page, features))
      if (hit) {
        e.preventDefault()
        setPage(hit.page)
      } else if (e.key === 'Escape' && !document.querySelector('.modal')) {
        setPage('home')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, features])

  const toastLayer = (
    <div className="toasts" aria-live="polite">
      {toasts.map((x) => <div key={x.id} className={`toast ${x.kind}`}>{x.text}</div>)}
    </div>
  )

  if (state === 'loading') return <div className="center-screen">{t('common.loading')}</div>
  if (state === 'login' || !user) return <><LoginPage siteName={siteName} onDone={onLoggedIn} toast={toast} />{toastLayer}</>
  if (state === 'shift') {
    return <><ShiftStartPage user={user} onStarted={() => setState('ready')} onLogout={logout} toast={toast} />{toastLayer}</>
  }

  const ctx: AppCtx = {
    user, siteName, features, refreshFeatures, alerts, refreshAlerts, go: (p: Page) => { if (p === 'registers') setRegisterId(null); setPage(p) }, toast,
    registerId, openRegister: (id: number | null) => { setRegisterId(id); setPage('registers') },
    checkInExpected: (e) => { pendingExpected.current = e; setPage('in') },
    takeExpected: () => { const e = pendingExpected.current; pendingExpected.current = null; return e }
  }
  return (
    <Ctx.Provider value={ctx}>
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <BrandMark />
            <div>
              <strong>{appTitle(i18n.language)}</strong>
              {siteName && <span>{siteName}</span>}
            </div>
          </div>
          <div className="topbar-end">
            {sync?.configured && (
              <button type="button" className={`sync-pill ${sync.online ? 'ok' : 'off'}`} onClick={() => setPage('settings')}
                title={sync.lastSync ? t('sync.last', { time: formatDateTime(sync.lastSync, i18n.language as Lang) }) : t('sync.never')}>
                <Icon name="cloud" size={16} /> {t(sync.online ? 'sync.online' : 'sync.offline')}
              </button>
            )}
            {alerts.length > 0 && (
              <button type="button" className="alert-bell" onClick={() => setPage('home')} aria-label={t('alert.title')}>
                <Icon name="alert" size={18} /> {alerts.length}
              </button>
            )}
            <LangSwitch onChange={(l) => window.api.auth.setLanguage(l)} />
            <Clock />
            <div className="who">
              <span>{user.name}</span>
              <button type="button" className="link" onClick={logout}>{t('nav.logout')}</button>
            </div>
            {/* administrators of a PIN-only build skip the guard shift, so they have none to end */}
            {features.modules.shifts && user.role !== 'admin' && (
              <button type="button" className="end-shift" onClick={() => setEnding(true)}><Icon name="clock" size={18} /> {t('nav.endShift')}</button>
            )}
          </div>
        </header>
        <div className="body">
          <nav className="sidebar">
            {nav.map((n) => (
              <button key={n.page} type="button" className={`${page === n.page ? 'active' : ''} ${n.page === bottomPage ? 'nav-bottom' : ''}`}
                onClick={() => { if (n.page === 'registers') setRegisterId(null); setPage(n.page) }}>
                <Icon name={n.icon} /> <span>{t(n.key)}</span> {n.shortcut && <kbd>{n.shortcut}</kbd>}
              </button>
            ))}
          </nav>
          <main className="content">
            {page === 'home' && <HomePage />}
            {page === 'in' && <VisitorInPage />}
            {page === 'out' && <CheckOutPage />}
            {page === 'expected' && <ExpectedPage />}
            {page === 'vehicles' && <VehiclesPage />}
            {page === 'deliveries' && <DeliveriesPage />}
            {page === 'incidents' && <IncidentsPage />}
            {page === 'patrols' && <PatrolsPage />}
            {page === 'keys' && <KeysPage />}
            {page === 'notes' && <NotesPage />}
            {page === 'registers' && <RegistersPage />}
            {page === 'admin' && user.role === 'admin' && <AdminPage />}
            {page === 'log' && <LogPage />}
            {page === 'watchlist' && <WatchlistPage />}
            {page === 'settings' && <SettingsPage />}
          </main>
        </div>
      </div>
      {ending && <EndShiftDialog onClose={() => setEnding(false)} onEnded={logout} />}
      {toastLayer}
    </Ctx.Provider>
  )
}
