import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type {
  BadgeSettings, CheckInInput, CheckStatus, CustomFieldInput, ExpectedInput, DeliveryInput, ExportRange, IncidentInput, KeyItemInput, Lang, LendInput, NoteCategory,
  Features, Module, RangeQuery, Role, SearchQuery, SetupInput, Settings, User, VehicleInInput, WatchHit, WatchInput
} from '@shared/types'
import { ALL_ON, PROFILES } from '@shared/features'
import { LANGS } from '@shared/i18n'
import * as db from './db'
import { verifyPin } from './crypto'
import { analyzeImage, barcodeTexts, readText } from './scan'
import { exportCheckpointLabels, exportEvacuation, exportExcel, exportPdf, exportShiftReport } from './export'
import * as vehicles from './vehicles'
import * as deliveries from './deliveries'
import * as incidents from './incidents'
import * as shifts from './shifts'
import * as watch from './watchlist'
import * as custom from './customFields'
import * as patrols from './patrols'
import * as keys from './keys'
import { currentAlerts } from './alerts'
import * as expected from './expected'
import * as sync from './sync'
import { getBadgeSettings, listPrinters, previewBadge, printBadge, setBadgeSettings } from './badges'

let currentUser: User | null = null

const failedLogins = new Map<number, { count: number; until: number }>()
const MAX_ATTEMPTS = 5
const LOCK_MS = 30_000

type Access = 'public' | 'user' | 'admin'

/** Actions of an optional module are refused while the module is switched off (history stays readable). */
const MODULE_WRITES: Record<string, Module> = {
  'vehicles:checkIn': 'vehicles', 'vehicles:checkOut': 'vehicles',
  'deliveries:add': 'deliveries', 'deliveries:pickUp': 'deliveries',
  'incidents:add': 'incidents', 'incidents:close': 'incidents',
  'patrols:start': 'patrols', 'patrols:check': 'patrols', 'patrols:finish': 'patrols', 'patrols:addCheckpoint': 'patrols',
  'keys:lend': 'keys', 'keys:giveBack': 'keys', 'keys:addItem': 'keys',
  'notes:add': 'notes',
  'watchlist:add': 'watchlist', 'watchlist:setActive': 'watchlist',
  'shifts:start': 'shifts', 'shifts:end': 'shifts',
  'expected:add': 'preregistration', 'expected:cancel': 'preregistration',
  'badges:print': 'badges'
}

function handle<A extends unknown[], R>(channel: string, access: Access, fn: (user: User, ...args: A) => R | Promise<R>): void {
  ipcMain.handle(channel, (_e: IpcMainInvokeEvent, ...args: unknown[]) => {
    if (access !== 'public') {
      if (!currentUser) throw new Error('error.forbidden')
      if (access === 'admin' && currentUser.role !== 'admin') throw new Error('error.forbidden')
    }
    const mod = MODULE_WRITES[channel]
    if (mod && !db.getFeatures().modules[mod]) throw new Error('error.featureOff')
    return fn(currentUser as User, ...(args as A))
  })
}

const validPin = (pin: string): boolean => /^\d{4,8}$/.test(pin)

/** Every watchlist hit at an entry is recorded, and so is a supervisor override. */
function auditWatch(userId: number, entity: string, entityId: number, hits: WatchHit[], overrideBy: number | null): void {
  if (hits.length === 0) return
  db.audit(userId, 'watchlist_hit', entity, entityId, JSON.stringify(hits.map((h) => ({ id: h.id, level: h.level, match: h.match }))))
  if (overrideBy) db.audit(overrideBy, 'watchlist_override', entity, entityId)
}
const checkLang = (l: string): Lang => (LANGS.includes(l as Lang) ? (l as Lang) : 'en')
const postName = (): string => db.getSettings().postName
const watchOn = (): boolean => db.getFeatures().modules.watchlist

export function registerIpc(): void {
  // ---------- auth ----------
  handle('auth:status', 'public', () => ({
    needsSetup: db.userCount() === 0, user: currentUser, siteName: db.getSettings().siteName, features: db.getFeatures()
  }))

  handle('auth:setup', 'public', (_u, input: SetupInput) => {
    if (db.userCount() > 0) throw new Error('error.forbidden')
    if (!validPin(input.pin)) throw new Error('setup.pinShort')
    db.setSettings({ ...db.getSettings(), siteName: input.siteName, postName: input.postName })
    db.setFeatures(PROFILES[input.profile] ?? ALL_ON)
    const id = db.createUser(input.adminName || 'Admin', 'admin', input.pin, checkLang(input.language))
    currentUser = db.getUser(id)
    db.audit(id, 'setup')
    return currentUser
  })

  handle('auth:loginUsers', 'public', () => db.listUsers(true).map((u) => ({ id: u.id, name: u.name, role: u.role })))

  handle('auth:login', 'public', (_u, userId: number, pin: string) => {
    const lock = failedLogins.get(userId)
    if (lock && lock.until > Date.now()) throw new Error(`login.locked:${Math.ceil((lock.until - Date.now()) / 1000)}`)
    const row = db.getUserRow(userId)
    if (!row || row.active !== 1 || !verifyPin(String(pin), row.pin_hash)) {
      const count = (lock?.count ?? 0) + 1
      failedLogins.set(userId, { count: count >= MAX_ATTEMPTS ? 0 : count, until: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0 })
      db.audit(userId, 'login_failed')
      throw new Error('login.wrongPin')
    }
    failedLogins.delete(userId)
    currentUser = db.getUser(userId)
    db.audit(userId, 'login')
    return currentUser
  })

  handle('auth:logout', 'user', (u) => {
    db.audit(u.id, 'logout')
    currentUser = null
  })

  handle('auth:setLanguage', 'user', (u, lang: Lang) => {
    db.updateUser(u.id, { language: checkLang(lang) })
    currentUser = db.getUser(u.id)
  })

  // ---------- visits ----------
  handle('visits:lookup', 'user', (_u, idNumber: string) => db.lookupPerson(String(idNumber)))

  handle('visits:checkIn', 'user', (u, input: CheckInInput) => {
    const w = watchOn()
      ? watch.enforceWatch({ idNumber: input.idNumber, name: input.fullName, plate: input.vehiclePlate }, input.supervisorPin)
      : { hits: [], overrideBy: null }
    const id = db.checkIn({ ...input, custom: custom.cleanValues('visit', input.custom) }, u.id, postName())
    db.audit(u.id, 'check_in', 'visit', id)
    auditWatch(u.id, 'visit', id, w.hits, w.overrideBy)
    if (input.expectedId) expected.markArrived(input.expectedId, id)
    return id
  })

  handle('visits:checkOut', 'user', (u, visitId: number, note: string) => {
    db.checkOut(visitId, u.id, String(note ?? ''))
    db.audit(u.id, 'check_out', 'visit', visitId)
  })

  handle('visits:insideNow', 'user', () => db.insideNow())
  handle('visits:search', 'user', (_u, q: SearchQuery) => db.searchVisits(q))
  handle('visits:get', 'user', (u, id: number) => {
    db.audit(u.id, 'view', 'visit', id)
    return db.getVisit(id)
  })
  handle('visits:stats', 'user', () => db.todayStats())
  handle('visits:suggestions', 'user', () => db.suggestions())

  // ---------- notes ----------
  handle('notes:add', 'user', (u, category: NoteCategory, text: string) => {
    const id = db.addNote(category, String(text), u.id, postName())
    db.audit(u.id, 'note', 'note', id)
  })
  handle('notes:list', 'user', (_u, from: string, to: string) => db.listNotes(from, to))

  // ---------- users ----------
  handle('users:list', 'admin', () => db.listUsers(false))
  handle('users:create', 'admin', (u, name: string, role: Role, pin: string, language: Lang) => {
    if (!String(name).trim()) throw new Error('error.nameRequired')
    if (!validPin(pin)) throw new Error('setup.pinShort')
    const id = db.createUser(name, role === 'admin' ? 'admin' : 'guard', pin, checkLang(language))
    db.audit(u.id, 'user_create', 'user', id)
  })
  handle('users:update', 'admin', (u, id: number, patch: { active?: boolean; pin?: string; role?: Role }) => {
    const target = db.getUser(id)
    if (!target) throw new Error('error.notFound')
    const losesAdmin = target.role === 'admin' && target.active && (patch.active === false || patch.role === 'guard')
    if (losesAdmin && db.activeAdminCount() <= 1) throw new Error('error.lastAdmin')
    if (patch.pin !== undefined && !validPin(patch.pin)) throw new Error('setup.pinShort')
    db.updateUser(id, patch)
    db.audit(u.id, 'user_update', 'user', id, Object.keys(patch).join(','))
  })

  // ---------- settings ----------
  handle('settings:get', 'user', () => db.getSettings())
  handle('settings:getFeatures', 'user', () => db.getFeatures())
  handle('settings:setFeatures', 'admin', (u, f: Features) => {
    db.setFeatures(f)
    db.audit(u.id, 'features', '', null, JSON.stringify(db.getFeatures()))
  })
  handle('settings:set', 'admin', (u, s: Settings) => {
    db.setSettings(s)
    db.audit(u.id, 'settings')
  })

  // ---------- scanning ----------
  handle('scan:analyze', 'user', (_u, image: Uint8Array) => analyzeImage(image))
  handle('scan:readText', 'user', (_u, image: Uint8Array) => readText(image))
  handle('scan:barcodes', 'user', (_u, image: Uint8Array) => barcodeTexts(image))

  // ---------- exports ----------
  const win = (): BrowserWindow | null => BrowserWindow.getFocusedWindow()
  handle('exports:pdf', 'user', async (u, r: ExportRange) => {
    const path = await exportPdf(win(), r, u.name)
    if (path) db.audit(u.id, 'export_pdf', '', null, `${r.from}..${r.to}`)
    return path
  })
  handle('exports:excel', 'user', async (u, r: ExportRange) => {
    const path = await exportExcel(win(), r)
    if (path) db.audit(u.id, 'export_excel', '', null, `${r.from}..${r.to}`)
    return path
  })
  handle('exports:evacuation', 'user', (u, lang: Lang) => {
    db.audit(u.id, 'evacuation_list')
    return exportEvacuation(checkLang(lang), u.name)
  })
  handle('exports:shiftReport', 'user', async (u, shiftId: number, lang: Lang) => {
    const path = await exportShiftReport(win(), shiftId, checkLang(lang), u.name)
    if (path) db.audit(u.id, 'export_shift_report', 'shift', shiftId)
    return path
  })

  // ---------- vehicles ----------
  handle('vehicles:lookup', 'user', (_u, plate: string) => vehicles.lookupVehicle(String(plate)))
  handle('vehicles:checkIn', 'user', (u, input: VehicleInInput) => {
    const w = watchOn() ? watch.enforceWatch({ plate: input.plate, name: input.driverName }, input.supervisorPin) : { hits: [], overrideBy: null }
    const id = vehicles.vehicleIn({ ...input, custom: custom.cleanValues('vehicle', input.custom) }, u.id, postName())
    db.audit(u.id, 'vehicle_in', 'vehicle', id)
    auditWatch(u.id, 'vehicle', id, w.hits, w.overrideBy)
    return id
  })
  handle('vehicles:checkOut', 'user', (u, id: number, note: string) => {
    vehicles.vehicleOut(id, u.id, String(note ?? ''))
    db.audit(u.id, 'vehicle_out', 'vehicle', id)
  })
  handle('vehicles:inside', 'user', () => vehicles.vehiclesInside())
  handle('vehicles:search', 'user', (_u, q: RangeQuery) => vehicles.searchVehicles(q))
  handle('vehicles:photo', 'user', (_u, id: number) => vehicles.vehiclePhoto(id))

  // ---------- deliveries ----------
  handle('deliveries:add', 'user', (u, input: DeliveryInput) => {
    const id = deliveries.addDelivery({ ...input, custom: custom.cleanValues('delivery', input.custom) }, u.id, postName())
    db.audit(u.id, 'delivery', 'delivery', id)
    return id
  })
  handle('deliveries:pickUp', 'user', (u, id: number, by: string) => {
    deliveries.pickUp(id, String(by ?? ''), u.id)
    db.audit(u.id, 'pickup', 'delivery', id)
  })
  handle('deliveries:waiting', 'user', () => deliveries.waitingDeliveries())
  handle('deliveries:search', 'user', (_u, q: RangeQuery) => deliveries.searchDeliveries(q))
  handle('deliveries:photo', 'user', (_u, id: number) => deliveries.deliveryPhoto(id))
  handle('deliveries:recipients', 'user', () => deliveries.frequentRecipients())

  // ---------- incidents ----------
  handle('incidents:add', 'user', (u, input: IncidentInput) => {
    const id = incidents.addIncident(input, u.id, postName())
    db.audit(u.id, 'incident', 'incident', id)
    return id
  })
  handle('incidents:close', 'user', (u, id: number, resolution: string) => {
    incidents.closeIncident(id, String(resolution ?? ''), u.id)
    db.audit(u.id, 'incident_close', 'incident', id)
  })
  handle('incidents:open', 'user', () => incidents.openIncidents())
  handle('incidents:search', 'user', (_u, q: RangeQuery) => incidents.searchIncidents(q))
  handle('incidents:get', 'user', (u, id: number) => {
    db.audit(u.id, 'view', 'incident', id)
    return incidents.getIncident(id)
  })

  // ---------- shifts ----------
  handle('shifts:state', 'user', (u) => shifts.shiftState(u.id))
  handle('shifts:start', 'user', (u) => {
    const s = shifts.startShift(u.id, postName())
    db.audit(u.id, 'shift_start', 'shift', s.id)
    return s
  })
  handle('shifts:end', 'user', (u, note: string) => {
    const s = shifts.endShift(u.id, String(note ?? ''))
    db.audit(u.id, 'shift_end', 'shift', s.id)
    return s
  })
  handle('shifts:activity', 'user', (_u, from: string, to: string | null) => shifts.activity(from, to))
  handle('shifts:list', 'user', (_u, q: RangeQuery) => shifts.listShifts(q))

  // ---------- watchlist ----------
  handle('watchlist:check', 'user', (_u, q: { idNumber?: string; name?: string; plate?: string }) => (watchOn() ? watch.checkWatch(q ?? {}) : []))
  handle('watchlist:list', 'user', () => watch.listWatch())
  handle('watchlist:add', 'admin', (u, input: WatchInput) => {
    const id = watch.addWatch(input, u.id)
    db.audit(u.id, 'watchlist_add', 'watchlist', id)
  })
  handle('watchlist:setActive', 'admin', (u, id: number, active: boolean) => {
    watch.setWatchActive(id, !!active)
    db.audit(u.id, active ? 'watchlist_enable' : 'watchlist_disable', 'watchlist', id)
  })

  // ---------- patrols ----------
  handle('patrols:checkpoints', 'user', (_u, includeInactive: boolean) => patrols.listCheckpoints(!!includeInactive))
  handle('patrols:addCheckpoint', 'admin', (u, name: string, location: string) => {
    const id = patrols.addCheckpoint(String(name ?? ''), String(location ?? ''))
    db.audit(u.id, 'checkpoint_add', 'checkpoint', id)
  })
  handle('patrols:updateCheckpoint', 'admin', (u, id: number, patch: { name?: string; location?: string; active?: boolean }) => {
    patrols.updateCheckpoint(id, patch ?? {})
    db.audit(u.id, 'checkpoint_update', 'checkpoint', id)
  })
  handle('patrols:labelsPdf', 'user', (_u, lang: Lang) => exportCheckpointLabels(win(), checkLang(lang)))
  handle('patrols:current', 'user', (u) => patrols.currentRound(u.id))
  handle('patrols:start', 'user', (u) => {
    const r = patrols.startRound(u.id, postName())
    db.audit(u.id, 'patrol_start', 'patrol', r.id)
    return r
  })
  handle('patrols:check', 'user', (u, roundId: number, checkpointId: number, status: CheckStatus, note: string, method: 'manual' | 'qr') =>
    patrols.checkPoint(u.id, roundId, checkpointId, status, String(note ?? ''), method))
  handle('patrols:findByCode', 'user', (_u, code: string) => patrols.findByCode(String(code ?? '')))
  handle('patrols:finish', 'user', (u, roundId: number, note: string) => {
    patrols.finishRound(u.id, roundId, String(note ?? ''))
    db.audit(u.id, 'patrol_end', 'patrol', roundId)
  })
  handle('patrols:list', 'user', (_u, q: RangeQuery) => patrols.listRounds(q))
  handle('patrols:get', 'user', (_u, id: number) => patrols.getRound(id))

  // ---------- keys & equipment ----------
  handle('keys:items', 'user', (_u, includeInactive: boolean) => keys.listItems(!!includeInactive))
  handle('keys:addItem', 'admin', (u, input: KeyItemInput) => {
    const id = keys.addItem(input)
    db.audit(u.id, 'key_item_add', 'key_item', id)
  })
  handle('keys:setActive', 'admin', (u, id: number, active: boolean) => {
    keys.setItemActive(id, !!active)
    db.audit(u.id, active ? 'key_item_enable' : 'key_item_disable', 'key_item', id)
  })
  handle('keys:lend', 'user', (u, itemId: number, input: LendInput) => {
    const id = keys.lend(itemId, input, u.id)
    db.audit(u.id, 'key_out', 'key_loan', id)
  })
  handle('keys:giveBack', 'user', (u, loanId: number, note: string) => {
    keys.giveBack(loanId, String(note ?? ''), u.id)
    db.audit(u.id, 'key_in', 'key_loan', loanId)
  })
  handle('keys:loans', 'user', (_u, q: RangeQuery) => keys.searchLoans(q))

  // ---------- alerts ----------
  handle('alerts:list', 'user', () => currentAlerts())

  // ---------- custom fields ----------
  handle('customFields:list', 'user', (_u, includeInactive: boolean) => custom.listFields(!!includeInactive))
  handle('customFields:add', 'admin', (u, input: CustomFieldInput) => {
    const id = custom.addField(input)
    db.audit(u.id, 'custom_field_add', 'custom_field', id)
  })
  handle('customFields:update', 'admin', (u, id: number, patch: Partial<CustomFieldInput> & { active?: boolean }) => {
    custom.updateField(id, patch ?? {})
    db.audit(u.id, 'custom_field_update', 'custom_field', id)
  })

  // ---------- expected visitors ----------
  handle('expected:list', 'user', () => expected.listExpected())
  handle('expected:add', 'user', (u, input: ExpectedInput) => {
    const id = expected.addExpected(input, u.id)
    db.audit(u.id, 'expected_add', 'expected', id)
  })
  handle('expected:cancel', 'user', (u, id: number) => {
    expected.cancelExpected(id)
    db.audit(u.id, 'expected_cancel', 'expected', id)
  })
  handle('expected:findByRef', 'user', (_u, ref: string) => expected.findByRef(String(ref ?? '')))

  // ---------- server connection ----------
  handle('sync:status', 'user', () => sync.syncStatus())
  handle('sync:connect', 'admin', async (u, url: string, code: string, deviceName: string) => {
    const s = await sync.connect(String(url ?? ''), String(code ?? ''), String(deviceName ?? ''))
    db.audit(u.id, 'sync_connect', '', null, s.url)
    return s
  })
  handle('sync:disconnect', 'admin', (u) => {
    sync.disconnect()
    db.audit(u.id, 'sync_disconnect')
  })
  handle('sync:now', 'user', () => sync.runSync())

  // ---------- badges ----------
  handle('badges:settings', 'user', () => getBadgeSettings())
  handle('badges:setSettings', 'admin', (u, s: BadgeSettings) => {
    setBadgeSettings(s)
    db.audit(u.id, 'badge_settings')
  })
  handle('badges:printers', 'admin', () => listPrinters())
  handle('badges:print', 'user', async (u, visitId: number) => {
    await printBadge(visitId, u.language)
    db.audit(u.id, 'badge_print', 'visit', visitId)
  })
  handle('badges:preview', 'admin', (u, visitId: number, s: BadgeSettings) => previewBadge(visitId, u.language, s))
}
