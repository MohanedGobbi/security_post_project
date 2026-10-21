import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import type {
  BadgeSettings, CheckInInput, CheckStatus, CustomFieldInput, ExpectedInput, DeliveryInput, ExportRange, IncidentInput, KeyItemInput, Lang, LendInput, NoteCategory,
  Features, Module, RangeQuery, Role, SearchQuery, Settings, User, VehicleInInput, WatchHit, WatchInput,
  AuditQuery, LevelInput, Permission, StudentInput, ScanOptions, EntryInputValues, EntryQuery, FieldInput, RegisterDefInput
} from '@shared/types'
import { ALL_ON, PROFILES } from '@shared/features'
import { can } from '@shared/permissions'
import { LANGS } from '@shared/i18n'
import * as db from './db'
import { DEFAULT_PINS } from '@shared/faculty'
import { verifyPin } from './crypto'
import { analyzeImage, barcodeTexts, readFront, readText } from './scan'
import * as students from './students'
import * as backup from './backup'
import { exportAuditPdf, exportAuditXlsx, exportEntryXlsx, exportRegisterXlsx, exportStudentsPdf, exportStudentsXlsx, exportVisitXlsx, exportEntryPdf, exportRegisterPdf, exportVisitPdf, registersSections } from './printouts'
import { exportCheckpointLabels, exportInsideXlsx, exportEvacuation, exportExcel, exportPdf, exportShiftReport } from './export'
import * as vehicles from './vehicles'
import * as deliveries from './deliveries'
import * as incidents from './incidents'
import * as shifts from './shifts'
import * as watch from './watchlist'
import * as custom from './customFields'
import * as patrols from './patrols'
import * as keys from './keys'
import * as registers from './registers'
import { currentAlerts } from './alerts'
import * as expected from './expected'
import * as sync from './sync'
import { getBadgeSettings, listPrinters, previewBadge, printBadge, setBadgeSettings } from './badges'

let currentUser: User | null = null

const failedLogins = new Map<number, { count: number; until: number }>()
const MAX_ATTEMPTS = 5
const LOCK_MS = 30_000

type Access = 'public' | 'user' | 'admin'

/** What a level must allow for a call; administrators always pass. Calls not listed need only a signed-in account. */
const PERMISSION_OF: Record<string, Permission> = {
  'visits:lookup': 'visitors', 'visits:checkIn': 'visitors', 'visits:checkOut': 'visitors', 'visits:insideNow': 'visitors', 'visits:suggestions': 'visitors',
  'visits:search': 'history', 'visits:get': 'history',
  'students:list': 'students', 'students:suggest': 'students', 'students:count': 'students',
  'students:save': 'studentsEdit', 'students:setActive': 'studentsEdit', 'students:import': 'studentsEdit', 'students:template': 'studentsEdit',
  'students:pdf': 'exports',
  'exports:pdf': 'exports', 'exports:excel': 'exports', 'exports:registerPdf': 'exports', 'exports:entryPdf': 'exports', 'exports:visitPdf': 'exports',
  'exports:registerXlsx': 'exports', 'exports:entryXlsx': 'exports', 'exports:visitXlsx': 'exports', 'exports:insideXlsx': 'visitors', 'students:xlsx': 'exports'
}

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
    const perm = PERMISSION_OF[channel]
    if (perm && access !== 'public' && !can(currentUser as User, perm)) throw new Error('error.forbidden')
    const mod = MODULE_WRITES[channel]
    if (mod && !db.getFeatures().modules[mod]) throw new Error('error.featureOff')
    return fn(currentUser as User, ...(args as A))
  })
}

const validPin = (pin: string): boolean => /^\d{4,8}$/.test(pin)
/** Roles an administrator can give; anything else becomes a guard */
const checkRole = (r: string): Role => (db.levelExists(String(r)) ? String(r) : 'guard')
/** The administrator's own PIN again, before anything that cannot be undone */
function checkAdminPin(u: User, pin: string): void {
  checkLock(u.id)
  const row = db.getUserRow(u.id)
  if (!row || !verifyPin(String(pin ?? ''), row.pin_hash)) {
    db.audit(u.id, 'login_failed', '', null, 'confirm')
    failLogin(u.id)
  }
  failedLogins.delete(u.id)
}

/** PIN-only login has no user id: its failed attempts share one counter */
const PIN_ONLY = 0

function checkLock(key: number): void {
  const lock = failedLogins.get(key)
  if (lock && lock.until > Date.now()) throw new Error(`login.locked:${Math.ceil((lock.until - Date.now()) / 1000)}`)
}

function failLogin(key: number): never {
  const count = (failedLogins.get(key)?.count ?? 0) + 1
  failedLogins.set(key, { count: count >= MAX_ATTEMPTS ? 0 : count, until: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0 })
  throw new Error('login.wrongPin')
}

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
  handle('auth:status', 'public', () => backup.inRecovery()
    ? { user: null, recovery: true, siteName: '', features: ALL_ON }
    : { user: currentUser, siteName: db.getSettings().siteName, features: db.getFeatures() })

  handle('auth:loginUsers', 'public', () => db.listUsers(true).map((u) => ({ id: u.id, name: u.name, role: u.role })))

  handle('auth:login', 'public', (_u, userId: number, pin: string) => {
    checkLock(userId)
    const row = db.getUserRow(userId)
    if (!row || row.active !== 1 || !verifyPin(String(pin), row.pin_hash)) {
      db.audit(userId, 'login_failed')
      failLogin(userId)
    }
    failedLogins.delete(userId)
    currentUser = db.getUser(userId)
    db.audit(userId, 'login')
    return currentUser
  })

  // the PIN alone says who is logging in (PINs are unique)
  handle('auth:loginPin', 'public', (_u, pin: string) => {
    checkLock(PIN_ONLY)
    const row = validPin(String(pin)) ? db.findUserByPin(String(pin)) : undefined
    if (!row || row.active !== 1) {
      db.audit(row?.id ?? null, 'login_failed', '', null, 'pin')
      failLogin(PIN_ONLY)
    }
    failedLogins.delete(PIN_ONLY)
    currentUser = db.getUser(row.id)
    db.audit(row.id, 'login', '', null, 'pin')
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
    const v = db.getVisit(id)
    // the pictures of ID cards (and the visitor's photo) are for the levels allowed to see them
    return can(u, 'cardPictures') ? v : { ...v, photo: null, cards: [] }
  })
  handle('visits:stats', 'user', () => db.todayStats())
  handle('visits:suggestions', 'user', () => db.suggestions())

  // ---------- notes ----------
  handle('notes:add', 'user', (u, category: NoteCategory, text: string) => {
    const id = db.addNote(category, String(text), u.id, postName())
    db.audit(u.id, 'note', 'note', id)
  })
  handle('notes:list', 'user', (_u, from: string, to: string) => db.listNotes(from, to))

  // ---------- registers (generic engine) ----------
  handle('registers:list', 'user', (u) => registers.listRegisters(u))
  handle('registers:save', 'admin', (u, def: RegisterDefInput) => {
    const id = registers.saveRegister(def, u.id)
    db.audit(u.id, def.id ? 'register_update' : 'register_open', 'register', id)
    return id
  })
  handle('registers:entries', 'user', (u, q: EntryQuery) => {
    const rows = registers.listEntries(q, u)
    // browsing a register's history is logged, like asking the dean's permission to read the book
    if (u.role === 'admin' && q.from) db.audit(u.id, 'view', 'register', q.registerId, `${q.from}..${q.to}`)
    return rows
  })
  handle('registers:add', 'user', (u, registerId: number, values: EntryInputValues) => {
    const r = registers.addEntry(registerId, values, u, postName())
    db.audit(u.id, 'entry_add', 'register_entry', r.id, String(registerId))
    return r
  })
  handle('registers:close', 'user', (u, entryId: number, values: EntryInputValues) => {
    const registerId = registers.closeEntry(entryId, values, u)
    db.audit(u.id, 'entry_close', 'register_entry', entryId, String(registerId))
  })
  handle('registers:correct', 'user', (u, entryId: number, fieldKey: string, value: FieldInput, reason: string) => {
    registers.correctEntry(entryId, String(fieldKey), value, String(reason ?? ''), u)
    db.audit(u.id, 'entry_correct', 'register_entry', entryId, String(fieldKey))
  })
  handle('registers:corrections', 'user', (_u, entryId: number) => registers.entryCorrections(entryId))
  handle('registers:accounts', 'user', () => registers.accountsForFields())
  handle('registers:delete', 'admin', (u, id: number, pin: string) => {
    const reg = registers.getRegister(Number(id))
    if (!reg) throw new Error('error.notFound')
    // entries are never erased in daily use: deleting a register that holds some needs the administrator's PIN, and a safety copy first
    if ((reg.entryCount ?? 0) > 0) {
      checkAdminPin(u, pin)
      backup.makeSafetyCopy('before-delete')
    }
    const r = registers.deleteRegister(reg.id)
    db.audit(u.id, 'register_delete', 'register', null, `${r.key} (${r.entries})`)
  })
  handle('registers:installTemplates', 'admin', (u, keys: string[]) => {
    const n = registers.installTemplates(Array.isArray(keys) ? keys.map(String) : [], u.id)
    if (n) db.audit(u.id, 'register_open', 'register', null, `templates:${n}`)
    return n
  })

  // ---------- system: backups, restore, reset ----------
  const askFile = async (kind: 'save' | 'open', name: string): Promise<string | null> => {
    const fixed = process.env[kind === 'save' ? 'SECREG_EXPORT_DIR' : 'SECREG_BACKUP_FILE']
    if (fixed) return kind === 'save' ? join(fixed, name) : fixed
    const parent = BrowserWindow.getFocusedWindow()
    const filters = [{ name: 'Backup', extensions: ['secbak'] }]
    if (kind === 'save') {
      const opts = { defaultPath: join(app.getPath('documents'), name), filters }
      const res = parent ? await dialog.showSaveDialog(parent, opts) : await dialog.showSaveDialog(opts)
      return res.canceled || !res.filePath ? null : res.filePath
    }
    const opts = { properties: ['openFile' as const], filters }
    const res = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts)
    return res.canceled || !res.filePaths[0] ? null : res.filePaths[0]
  }
  handle('system:info', 'admin', () => backup.backupInfo())
  handle('system:backup', 'admin', async (u, password: string) => {
    const path = await askFile('save', `backup_${new Date().toISOString().slice(0, 10)}.secbak`)
    if (!path) return null
    backup.writePortableBackup(path, String(password ?? ''))
    db.audit(u.id, 'backup_create')
    return path
  })
  handle('system:restoreFile', 'admin', async (u, password: string, pin: string) => {
    checkAdminPin(u, pin)
    const path = await askFile('open', '')
    if (!path) return false
    // wrong password or not a backup: found out before anything is touched
    backup.readPortableBackup(path, String(password ?? ''))
    db.audit(u.id, 'backup_restore', '', null, 'file')
    backup.makeSafetyCopy('before-restore')
    backup.restoreFromFile(path, String(password ?? ''))
    return true
  })
  handle('system:restoreCopy', 'admin', (u, name: string, pin: string) => {
    checkAdminPin(u, pin)
    db.audit(u.id, 'backup_restore', '', null, String(name))
    backup.makeSafetyCopy('before-restore')
    backup.restoreSafetyCopy(String(name))
  })
  handle('system:erase', 'admin', (u, pin: string, includeStudents: boolean) => {
    checkAdminPin(u, pin)
    backup.makeSafetyCopy('before-erase')
    backup.eraseRecords(!!includeStudents)
    db.audit(u.id, 'records_erase', '', null, includeStudents ? 'with students' : '')
  })
  handle('system:factoryReset', 'admin', (u, pin: string) => {
    checkAdminPin(u, pin)
    backup.makeSafetyCopy('before-reset')
    backup.factoryReset()
  })
  handle('system:openFolder', 'admin', async () => {
    mkdirSync(backup.backupsDir(), { recursive: true })
    await shell.openPath(backup.backupsDir())
  })
  handle('system:restart', 'admin', (u) => {
    db.audit(u.id, 'restart')
    backup.restartProgram()
  })
  // the data key cannot be opened, nobody can log in: a backup file is the way back
  handle('system:recover', 'public', async (_u, password: string) => {
    if (!backup.inRecovery()) throw new Error('error.forbidden')
    const path = await askFile('open', '')
    if (!path) return false
    backup.restoreFromFile(path, String(password ?? ''))
    return true
  })

  // ---------- audit trail ----------
  handle('audit:list', 'admin', (_u, q: AuditQuery) => db.listAudit(q))

  // ---------- permission levels ----------
  handle('levels:list', 'user', () => db.listLevels())
  handle('levels:save', 'admin', (u, input: LevelInput) => {
    const key = db.saveLevel(input)
    db.audit(u.id, input.key ? 'level_update' : 'level_add', 'level', null, key)
    return key
  })
  handle('levels:remove', 'admin', (u, key: string) => {
    db.deleteLevel(String(key))
    db.audit(u.id, 'level_remove', 'level', null, String(key))
  })

  // ---------- users ----------
  handle('users:list', 'admin', () => {
    const stillDefault = db.usersWithDefaultPin(DEFAULT_PINS)
    return db.listUsers(false).map((u) => ({ ...u, defaultPin: stillDefault.has(u.id) }))
  })
  handle('users:create', 'admin', (u, name: string, role: Role, pin: string, language: Lang) => {
    if (!String(name).trim()) throw new Error('error.nameRequired')
    if (!validPin(pin)) throw new Error('setup.pinShort')
    const id = db.createUser(name, checkRole(role), pin, checkLang(language))
    db.audit(u.id, 'user_create', 'user', id)
  })
  handle('users:update', 'admin', (u, id: number, patch: { active?: boolean; pin?: string; role?: Role }) => {
    const target = db.getUser(id)
    if (!target) throw new Error('error.notFound')
    if (patch.role !== undefined) patch.role = checkRole(patch.role)
    const losesAdmin = target.role === 'admin' && target.active && (patch.active === false || (patch.role !== undefined && patch.role !== 'admin'))
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
  handle('scan:analyze', 'user', (_u, image: Uint8Array, opts?: ScanOptions) => analyzeImage(image, opts ?? {}))
  handle('scan:readText', 'user', (_u, image: Uint8Array) => readText(image))
  handle('scan:readFront', 'user', (_u, image: Uint8Array) => readFront(image))
  handle('scan:barcodes', 'user', (_u, image: Uint8Array) => barcodeTexts(image))

  // ---------- students ----------
  // guards search the directory; the phone, national number and birth date are for those who maintain it
  handle('students:list', 'user', (u, q: { text: string; includeInactive: boolean }) =>
    students.listStudents({ text: String(q?.text ?? ''), includeInactive: !!q?.includeInactive && can(u, 'studentsEdit') })
      .map((m) => (can(u, 'studentsEdit') ? m : { ...m, student: { ...m.student, idNumber: '', phone: '', birthDate: '' } })))
  handle('students:suggest', 'user', (_u, q: { name: string; idNumber: string }) => students.suggestStudents({ name: String(q?.name ?? ''), idNumber: String(q?.idNumber ?? '') }))
  handle('students:count', 'user', () => students.studentCount())
  handle('students:save', 'user', (u, input: StudentInput) => {
    const id = students.saveStudent(input)
    db.audit(u.id, input.id ? 'student_update' : 'student_add', 'student', id)
    return id
  })
  handle('students:setActive', 'user', (u, id: number, active: boolean) => {
    students.setStudentActive(Number(id), !!active)
    db.audit(u.id, 'student_update', 'student', Number(id), active ? 'on' : 'off')
  })
  handle('students:remove', 'admin', (u, id: number) => {
    students.removeStudent(Number(id))
    db.audit(u.id, 'student_remove', 'student', Number(id))
  })
  handle('students:import', 'user', async (u) => {
    const parent = BrowserWindow.getFocusedWindow()
    const fixed = process.env['SECREG_IMPORT_FILE']
    let file = fixed ?? ''
    if (!file) {
      const opts = { properties: ['openFile' as const], filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'csv'] }] }
      const res = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts)
      if (res.canceled || !res.filePaths[0]) return null
      file = res.filePaths[0]
    }
    const r = await students.importStudentsFile(file)
    db.audit(u.id, 'student_import', 'student', null, `+${r.added} ~${r.updated} -${r.skipped}`)
    return r
  })
  handle('students:template', 'user', (_u, lang: Lang) => students.saveTemplate(BrowserWindow.getFocusedWindow(), checkLang(lang)))
  handle('students:xlsx', 'user', async (u, q: { text: string; includeInactive: boolean }, lang: Lang) => {
    const full = can(u, 'studentsEdit')
    const rows = students.listStudents({ text: String(q?.text ?? ''), includeInactive: !!q?.includeInactive && full })
    const path = await exportStudentsXlsx(BrowserWindow.getFocusedWindow(), rows, checkLang(lang), full)
    if (path) db.audit(u.id, 'export_excel', 'student')
    return path
  })
  handle('students:pdf', 'user', async (u, q: { text: string; includeInactive: boolean }, lang: Lang) => {
    const path = await exportStudentsPdf(BrowserWindow.getFocusedWindow(), students.listStudents({ text: String(q?.text ?? ''), includeInactive: !!q?.includeInactive }), checkLang(lang), u.name)
    if (path) db.audit(u.id, 'export_pdf', 'student')
    return path
  })

  // ---------- exports ----------
  const win = (): BrowserWindow | null => BrowserWindow.getFocusedWindow()
  handle('exports:pdf', 'user', async (u, r: ExportRange) => {
    const path = await exportPdf(win(), r, u.name, registersSections(u, r.from, r.to, r.lang))
    if (path) db.audit(u.id, 'export_pdf', '', null, `${r.from}..${r.to}`)
    return path
  })
  handle('exports:excel', 'user', async (u, r: ExportRange) => {
    const path = await exportExcel(win(), r, registersSections(u, r.from, r.to, r.lang))
    if (path) db.audit(u.id, 'export_excel', '', null, `${r.from}..${r.to}`)
    return path
  })
  handle('exports:registerPdf', 'user', async (u, q: EntryQuery, lang: Lang) => {
    const path = await exportRegisterPdf(win(), u, q, checkLang(lang))
    if (path) db.audit(u.id, 'export_pdf', 'register', q.registerId, `${q.from}..${q.to}`)
    return path
  })
  handle('exports:entryPdf', 'user', async (u, entryId: number, lang: Lang) => {
    const path = await exportEntryPdf(win(), u, entryId, checkLang(lang))
    if (path) db.audit(u.id, 'export_pdf', 'register_entry', entryId)
    return path
  })
  handle('exports:registerXlsx', 'user', async (u, q: EntryQuery, lang: Lang) => {
    const path = await exportRegisterXlsx(win(), u, q, checkLang(lang))
    if (path) db.audit(u.id, 'export_excel', 'register', q.registerId, `${q.from}..${q.to}`)
    return path
  })
  handle('exports:entryXlsx', 'user', async (u, entryId: number, lang: Lang) => {
    const path = await exportEntryXlsx(win(), u, entryId, checkLang(lang))
    if (path) db.audit(u.id, 'export_excel', 'register_entry', entryId)
    return path
  })
  handle('exports:auditXlsx', 'admin', async (u, q: AuditQuery, lang: Lang) => {
    const path = await exportAuditXlsx(win(), q, checkLang(lang))
    if (path) db.audit(u.id, 'export_excel', 'audit', null, `${q.from}..${q.to}`)
    return path
  })
  handle('exports:visitXlsx', 'user', async (u, visitId: number, lang: Lang) => {
    const path = await exportVisitXlsx(win(), visitId, checkLang(lang))
    if (path) db.audit(u.id, 'export_excel', 'visit', visitId)
    return path
  })
  handle('exports:insideXlsx', 'user', async (u, lang: Lang) => {
    const path = await exportInsideXlsx(win(), checkLang(lang))
    if (path) db.audit(u.id, 'export_excel', '', null, 'inside')
    return path
  })
  handle('exports:auditPdf', 'admin', async (u, q: AuditQuery, lang: Lang) => {
    const path = await exportAuditPdf(win(), q, checkLang(lang), u.name)
    if (path) db.audit(u.id, 'export_pdf', 'audit', null, `${q.from}..${q.to}`)
    return path
  })
  handle('exports:visitPdf', 'user', async (u, visitId: number, lang: Lang) => {
    const path = await exportVisitPdf(win(), visitId, checkLang(lang), u.name)
    if (path) db.audit(u.id, 'export_pdf', 'visit', visitId)
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
