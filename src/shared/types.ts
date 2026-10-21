export type Lang = 'ar' | 'en' | 'fr'
/**
 * The key of an account's level: 'admin' (everything), 'leader' (head of a guard team, رئيس فرقة الأمن), 'guard',
 * or a level the administrator made (a name of lower-case letters, digits and _).
 */
export type Role = string

/** What a level may do (src/shared/permissions.ts says what each one allows) */
export type Permission = 'visitors' | 'history' | 'cardPictures' | 'students' | 'studentsEdit' | 'exports' | 'correctAny' | 'shiftHandover'

export interface Level {
  key: Role
  labels: Labels
  permissions: Permission[]
  /** guard, leader and admin: renamed and re-ticked as needed, never deleted */
  builtin: boolean
  /** active accounts at this level */
  users: number
}

export interface LevelInput { key?: Role; labels: Labels; permissions: Permission[] }

export interface User {
  id: number
  name: string
  role: Role
  /** what the level allows; administrators have all of them */
  permissions: Permission[]
  language: Lang
  active: boolean
  /** only in the accounts list of an administrator: the account still has the PIN it was created with */
  defaultPin?: boolean
}

/** Optional parts of the program, switched on per site in Settings → Features */
export type Module = 'vehicles' | 'deliveries' | 'incidents' | 'patrols' | 'keys' | 'notes' | 'watchlist' | 'shifts' | 'preregistration' | 'badges'

export interface Features {
  modules: Record<Module, boolean>
  /** visitor form */
  idScan: boolean
  visitorPhoto: boolean
  requireIdNumber: boolean
  badgeNumbers: boolean
}

export type ProfileId = 'small' | 'company' | 'large'

export interface AuthStatus {
  user: User | null
  /** the data key could not be opened (another Windows account or PC): the only thing possible is restoring a backup */
  recovery?: boolean
  siteName: string
  features: Features
}

export type IdType = 'national_id' | 'passport' | 'residence' | 'driver_license' | 'student' | 'employee' | 'other'

export interface PersonFields {
  fullName: string
  fullNameAlt: string
  idType: IdType
  idNumber: string
  nationality: string
  birthDate: string
  sex: string
  phone: string
  company: string
}

/** Pictures of the ID card kept with one entry */
export const MAX_CARD_PICTURES = 3

export interface CheckInInput extends PersonFields {
  host: string
  purpose: string
  badgeNo: string
  vehiclePlate: string
  notes: string
  /** JPEG bytes of the visitor photo taken at the desk */
  photo: Uint8Array | null
  /** JPEG pictures of the ID card(s) taken by the scanner (at most MAX_CARD_PICTURES), saved encrypted with the entry */
  cards?: Uint8Array[]
  /** an administrator's PIN, to let in someone on the "deny" watchlist */
  supervisorPin?: string
  custom: CustomValues
  /** the expected visitor (pre-registration) this check-in fulfils */
  expectedId?: number | null
}

export interface PersonLookup {
  personId: number
  fields: PersonFields
  visitsCount: number
  lastSeen: string | null
  insideVisitId: number | null
  lastHost: string
  lastPurpose: string
}

export interface VisitRow {
  id: number
  personId: number
  fullName: string
  fullNameAlt: string
  idType: IdType
  idNumber: string
  company: string
  host: string
  purpose: string
  badgeNo: string
  vehiclePlate: string
  notes: string
  timeIn: string
  timeOut: string | null
  guardIn: string
  guardOut: string | null
  hasPhoto: boolean
  /** how many pictures of the ID card are saved with this entry */
  cardCount: number
  custom: CustomValues
}

export interface VisitDetail extends VisitRow {
  nationality: string
  birthDate: string
  sex: string
  phone: string
  photo: Uint8Array | null
  /** the saved pictures of the ID card, oldest first */
  cards: Uint8Array[]
}

export interface SearchQuery {
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
  text: string
  status: 'all' | 'inside' | 'left'
}

/** 'incident', 'delivery' and 'handover' are kept for notes written before they got their own screens */
export type NoteCategory = 'general' | 'maintenance' | 'alarm' | 'patrol' | 'incident' | 'delivery' | 'handover'

export interface NoteRow {
  id: number
  time: string
  category: NoteCategory
  text: string
  guard: string
}

export interface TodayStats {
  inside: number
  inToday: number
  outToday: number
  notesToday: number
  vehiclesInside: number
  parcelsWaiting: number
  openIncidents: number
}

// ---------- vehicles ----------
export type VehicleType = 'car' | 'van' | 'truck' | 'motorcycle' | 'bus' | 'other'

export interface VehicleInInput {
  plate: string
  vehicleType: VehicleType
  color: string
  driverName: string
  company: string
  passengers: number
  cargo: string
  notes: string
  photo: Uint8Array | null
  supervisorPin?: string
  custom: CustomValues
}

export interface VehicleRow {
  id: number
  plate: string
  vehicleType: VehicleType
  color: string
  driverName: string
  company: string
  passengers: number
  cargo: string
  notes: string
  visitId: number | null
  timeIn: string
  timeOut: string | null
  guardIn: string
  guardOut: string | null
  hasPhoto: boolean
  custom: CustomValues
}

export interface VehicleLookup {
  visits: number
  lastSeen: string | null
  insideId: number | null
  last: Pick<VehicleInInput, 'vehicleType' | 'color' | 'driverName' | 'company'> | null
}

// ---------- deliveries ----------
export interface DeliveryInput {
  carrier: string
  courierName: string
  recipient: string
  parcels: number
  tracking: string
  notes: string
  photo: Uint8Array | null
  custom: CustomValues
}

export interface DeliveryRow {
  id: number
  time: string
  carrier: string
  courierName: string
  recipient: string
  parcels: number
  tracking: string
  notes: string
  guard: string
  pickedUpAt: string | null
  pickedUpBy: string
  guardPickup: string | null
  hasPhoto: boolean
  custom: CustomValues
}

// ---------- incidents ----------
export type IncidentType = 'theft' | 'intrusion' | 'damage' | 'fire_alarm' | 'medical' | 'fight' | 'suspicious' | 'lost_found' | 'safety' | 'other'
export type Severity = 'low' | 'medium' | 'high'

export interface IncidentInput {
  type: IncidentType
  severity: Severity
  occurredAt: string // ISO
  location: string
  description: string
  peopleInvolved: string
  actionTaken: string
  photos: Uint8Array[]
}

export interface IncidentRow {
  id: number
  type: IncidentType
  severity: Severity
  occurredAt: string
  createdAt: string
  location: string
  description: string
  peopleInvolved: string
  actionTaken: string
  guard: string
  closedAt: string | null
  closedBy: string | null
  resolution: string
  photoCount: number
}

export interface IncidentDetail extends IncidentRow {
  photos: Uint8Array[]
}

// ---------- shifts ----------
export interface ShiftRow {
  id: number
  userId: number
  guard: string
  post: string
  startedAt: string
  endedAt: string | null
  handoverNote: string
  acknowledgedBy: string | null
}

export interface ShiftSummary {
  visitorsIn: number
  visitorsOut: number
  vehiclesIn: number
  vehiclesOut: number
  parcelsReceived: number
  parcelsPickedUp: number
  incidents: number
  notes: number
  patrols: number
  /** live situation, for the handover */
  insideNow: number
  vehiclesInside: number
  parcelsWaiting: number
  openIncidents: number
  keysOut: number
}

export interface ShiftState {
  /** the open shift of the logged-in guard, if any */
  mine: ShiftRow | null
  /** most recent finished shift at this post: its handover note is shown to the next guard */
  previous: ShiftRow | null
  /** another guard's shift still open at this post */
  othersOpen: ShiftRow[]
  summary: ShiftSummary
}

export type ActivityKind = 'visit_in' | 'visit_out' | 'vehicle_in' | 'vehicle_out' | 'delivery' | 'pickup' | 'incident' | 'incident_closed' | 'note' | 'shift_start' | 'shift_end' | 'patrol' | 'key_out' | 'key_in'

export interface ActivityItem {
  time: string
  kind: ActivityKind
  title: string
  detail: string
  guard: string
}

// ---------- watchlist ----------
export type WatchLevel = 'deny' | 'alert'

export interface WatchInput {
  name: string
  idNumber: string
  plate: string
  reason: string
  level: WatchLevel
}

export interface WatchRow {
  id: number
  name: string
  idNumber: string
  plate: string
  reason: string
  level: WatchLevel
  addedBy: string
  createdAt: string
  active: boolean
  /** entries from the organisation's server are managed in the dashboard */
  source: 'local' | 'server'
}

export interface WatchHit {
  id: number
  level: WatchLevel
  reason: string
  name: string
  /** how it matched: exact ID number / plate, or same name (possible match) */
  match: 'id' | 'plate' | 'name'
}

export interface Settings {
  siteName: string
  postName: string
  retentionDays: number
  /** alert when a visitor is inside longer than this (0 = off) */
  overstayHours: number
  /** "HH:MM": alert for visitors still inside after this time ('' = off) */
  closingTime: string
  /** alert when a vehicle is inside longer than this (0 = off) */
  vehicleOverstayHours: number
  /** alert when no patrol round was finished for this long (0 = off) */
  patrolIntervalHours: number
}

// ---------- custom fields ----------
export type CustomEntity = 'visit' | 'vehicle' | 'delivery'
export type CustomFieldType = 'text' | 'number' | 'yesno' | 'select' | 'date'

export interface CustomFieldInput {
  entity: CustomEntity
  labels: { ar: string; en: string; fr: string }
  type: CustomFieldType
  options: string[]
  required: boolean
}

export interface CustomField extends CustomFieldInput {
  id: number
  active: boolean
}

/** values of custom fields, by field id */
export type CustomValues = Record<string, string>

// ---------- registers (generic engine: each register is a definition, the paper book becomes a list of entries) ----------
export type Labels = { ar: string; en: string; fr: string }

export type RegisterFieldType =
  | 'text' | 'longtext' | 'number' | 'date' | 'time' | 'datetime'
  /** yes / no */
  | 'yesno'
  /** yes / no, with a note that is required on "no" ("good / other: specify") */
  | 'yesno_note'
  | 'select'
  /** a person outside the system: name, ID type and number */
  | 'person'
  /** one of the app's accounts (a guard, a team leader…) */
  | 'account'
  /** someone confirms with their own PIN: replaces the signature on paper */
  | 'signature'

export const REGISTER_FIELD_TYPES: RegisterFieldType[] = [
  'text', 'longtext', 'number', 'date', 'time', 'datetime', 'yesno', 'yesno_note', 'select', 'person', 'account', 'signature'
]

export interface RegisterField {
  /** stable id inside the register: lower-case letters, digits, _ */
  key: string
  labels: Labels
  type: RegisterFieldType
  /** choices of a 'select' field */
  options: string[]
  required: boolean
  /** stored encrypted and left out of text search (ID numbers, addresses…) */
  sensitive: boolean
  /** 'open' = filled when the entry is recorded, 'close' = filled at the closing step */
  step: 'open' | 'close'
  /** a field is never removed once entries exist: it is hidden */
  active: boolean
  /** help text shown under the field in the entry form (any of the three languages may be empty) */
  hint?: Labels
  /** half the width of the form: two such fields side by side */
  half?: boolean
}

/** the accent colours an administrator can give a register ('' = the program's own) */
export const REGISTER_COLORS = ['', 'blue', 'teal', 'violet', 'amber', 'red', 'grey'] as const

export interface RegisterDef {
  id: number
  /** stable id ('lost_found', 'custom_3'…) */
  key: string
  labels: Labels
  /** an Icon name of the renderer */
  icon: string
  /** who may record entries */
  fillRoles: Role[]
  /** who may do the closing step */
  closeRoles: Role[]
  /** name of the closing step ("returned to its owner", "delivered"…); null = entries have no closing step */
  closeLabels: Labels | null
  sort: number
  active: boolean
  /** accent colour of its tile and heading, one of REGISTER_COLORS */
  color?: string
  /** how many entries it holds (known when read from the database) */
  entryCount?: number
  /** like the dean's "this register was opened on …" */
  openedAt: string
  openedBy: string
  fields: RegisterField[]
}

export type RegisterDefInput = Omit<RegisterDef, 'id' | 'openedAt' | 'openedBy'> & { id?: number }

export type YesNoNote = { answer: 'yes' | 'no'; note: string }
export type PersonValue = { name: string; idType: string; idNumber: string }
/** an account picked or confirmed: the name is kept as it was at that moment */
export type AccountValue = { userId: number; name: string }
export type FieldValue = string | YesNoNote | PersonValue | AccountValue
/** sent by the form: a 'signature' field carries the PIN, an 'account' field the user id */
export type FieldInput = string | YesNoNote | PersonValue | { pin: string } | { userId: number }
export type EntryValues = Record<string, FieldValue>
export type EntryInputValues = Record<string, FieldInput>

export interface RegisterEntry {
  id: number
  registerId: number
  /** running number in its register, like the numbered lines of the paper book */
  number: number
  values: EntryValues
  createdBy: string
  createdAt: string
  post: string
  closedBy: string | null
  closedAt: string | null
  /** keys of the fields that were corrected at least once */
  corrected: string[]
}

export interface EntryCorrection {
  fieldKey: string
  oldValue: FieldValue | null
  newValue: FieldValue | null
  reason: string
  by: string
  at: string
}

export interface EntryQuery {
  registerId: number
  /** YYYY-MM-DD; administrators only (others see the last 24 hours and open entries) */
  from: string
  to: string
  text: string
  /** only entries still waiting for their closing step */
  openOnly: boolean
}

// ---------- audit trail ----------
export interface AuditRow {
  id: number
  time: string
  /** account name; null = done by the program itself (automatic clean-up…) */
  user: string | null
  action: string
  entity: string
  entityId: number | null
  detail: string
}

export interface AuditQuery {
  /** YYYY-MM-DD */
  from: string
  to: string
  userId: number | null
  /** one action, or '' for all */
  action: string
}

// ---------- patrols ----------
export interface Checkpoint {
  id: number
  name: string
  location: string
  code: string
  active: boolean
}

export type CheckStatus = 'ok' | 'issue'

export interface PatrolCheck {
  checkpointId: number
  name: string
  location: string
  time: string | null
  status: CheckStatus | null
  note: string
  method: 'manual' | 'qr' | ''
}

export interface PatrolRound {
  id: number
  guard: string
  startedAt: string
  endedAt: string | null
  note: string
  total: number
  done: number
  issues: number
}

export interface PatrolRoundDetail extends PatrolRound {
  checks: PatrolCheck[]
}

// ---------- keys & equipment ----------
export type KeyKind = 'key' | 'badge' | 'radio' | 'equipment' | 'other'

export interface KeyItemInput {
  label: string
  kind: KeyKind
  code: string
  location: string
}

export interface KeyLoan {
  id: number
  itemId: number
  itemLabel: string
  borrower: string
  borrowerInfo: string
  outAt: string
  dueAt: string | null
  returnedAt: string | null
  guardOut: string
  guardIn: string | null
  notes: string
}

export interface KeyItem extends KeyItemInput {
  id: number
  active: boolean
  loan: KeyLoan | null
}

export interface LendInput {
  borrower: string
  borrowerInfo: string
  dueAt: string | null
  notes: string
}

// ---------- alerts ----------
export type AlertKind = 'visitor_overstay' | 'visitor_after_closing' | 'vehicle_overstay' | 'key_overdue' | 'patrol_due'

export interface AlertItem {
  kind: AlertKind
  refId: number | null
  title: string
  detail: string
  since: string | null
}

/** What one reading attempt does (the scan pipeline retries a frame in several versions) */
export interface ScanOptions {
  /** look for QR / barcodes first (default true) */
  barcodes?: boolean
  /** when no document validates, also run the multilingual text read for lines to pick from (default true) */
  text?: boolean
}

export interface ScanResult {
  /** 'ocr': fields taken from the printed text of the card front (no check digits exist: the guard must verify every field) */
  source: 'mrz' | 'barcode' | 'ocr' | 'none'
  /** 'ocr' only: a name and a national number or birth date were read, so trying the machine-readable zone is not needed */
  complete?: boolean
  fields: Partial<PersonFields>
  /** check digits all valid (MRZ only) */
  valid: boolean
  rawMrz: string[]
  barcodes: { format: string; text: string }[]
  /** text lines read from the card when the MRZ could not be fully read */
  lines: string[]
}

// ---------- students (directory) ----------
export interface Student {
  id: number
  /** the number on the student card; also what a scanned student card gives as its ID number */
  studentNo: string
  /** national identity number, when known */
  idNumber: string
  fullName: string
  fullNameAlt: string
  birthDate: string
  phone: string
  /** year of study (L1, M2…) */
  level: string
  /** department / specialty */
  department: string
  notes: string
  active: boolean
}

export type StudentInput = Omit<Student, 'id' | 'active'> & { id?: number; active?: boolean }

/** a student found by a search or suggested for a name / ID, with what the visit log knows about them */
export interface StudentMatch {
  student: Student
  /** 1 = the same card number, otherwise how alike the names are (0..1) */
  score: number
  exact: boolean
  /** the visit they are inside with, if any */
  insideVisitId: number | null
  insideSince: string | null
  lastSeen: string | null
  visitsCount: number
}

/** a copy the program made of its database, kept on this PC */
export interface SafetyCopy {
  /** folder name, also its id */
  name: string
  /** auto (daily) or before-restore, before-erase, before-reset, before-delete */
  kind: string
  time: string
  bytes: number
}

export interface BackupInfo {
  dataDir: string
  backupsDir: string
  dbBytes: number
  copies: SafetyCopy[]
  /** when the last portable backup file was made */
  lastBackup: string | null
}

export interface StudentImportResult { added: number; updated: number; skipped: number; file: string }

// ---------- expected visitors (pre-registration) ----------
export interface ExpectedInput {
  fullName: string
  company: string
  host: string
  purpose: string
  phone: string
  validFrom: string // YYYY-MM-DD
  validTo: string
  notes: string
}

export interface ExpectedVisitor extends ExpectedInput {
  id: number
  refCode: string
  status: 'pending' | 'arrived' | 'cancelled'
  /** created on this post, or received from the server (dashboard) */
  source: 'local' | 'server'
  arrivedAt: string | null
  visitId: number | null
}

// ---------- server connection ----------
export interface SyncStatus {
  configured: boolean
  url: string
  siteName: string
  deviceName: string
  lastSync: string | null
  lastError: string
  /** last attempt reached the server */
  online: boolean
  syncing: boolean
}

// ---------- badges ----------
export type BadgeSize = 'cr80' | 'label62' | 'a6'

export interface BadgeSettings {
  /** Windows printer name; '' = ask with the print dialog */
  printer: string
  size: BadgeSize
  autoPrint: boolean
  showPhoto: boolean
}

export interface ExportRange {
  from: string
  to: string
  lang: Lang
}

export interface RangeQuery {
  from: string
  to: string
  text: string
}

export interface Api {
  auth: {
    status(): Promise<AuthStatus>
    loginUsers(): Promise<{ id: number; name: string; role: Role }[]>
    login(userId: number, pin: string): Promise<User>
    /** the PIN alone identifies the person (PINs are unique) */
    loginPin(pin: string): Promise<User>
    logout(): Promise<void>
    setLanguage(lang: Lang): Promise<void>
  }
  visits: {
    lookup(idNumber: string): Promise<PersonLookup | null>
    checkIn(input: CheckInInput): Promise<number>
    checkOut(visitId: number, note: string): Promise<void>
    insideNow(): Promise<VisitRow[]>
    search(q: SearchQuery): Promise<VisitRow[]>
    get(visitId: number): Promise<VisitDetail>
    stats(): Promise<TodayStats>
    suggestions(): Promise<{ hosts: string[]; purposes: string[] }>
  }
  notes: {
    add(category: NoteCategory, text: string): Promise<void>
    list(from: string, to: string): Promise<NoteRow[]>
  }
  registers: {
    /** registers this user may fill or close (administrators: all, switched-off ones too) */
    list(): Promise<RegisterDef[]>
    /** administrators: create or change a register definition */
    save(def: RegisterDefInput): Promise<number>
    entries(q: EntryQuery): Promise<RegisterEntry[]>
    add(registerId: number, values: EntryInputValues): Promise<{ id: number; number: number }>
    close(entryId: number, values: EntryInputValues): Promise<void>
    /** entries are never erased: a wrong value is corrected and the correction is kept */
    correct(entryId: number, fieldKey: string, value: FieldInput, reason: string): Promise<void>
    corrections(entryId: number): Promise<EntryCorrection[]>
    /** accounts for 'account' fields */
    accounts(): Promise<{ id: number; name: string; role: Role; roleLabels: Labels }[]>
    /** administrators: deletes a register with its entries; the PIN is checked when it holds entries. A safety copy is made first. */
    delete(id: number, pin: string): Promise<void>
    /** administrators: opens the ready-made registers with these keys that do not exist yet; returns how many */
    installTemplates(keys: string[]): Promise<number>
  }
  audit: {
    /** administrators: the audit trail of a period, newest first */
    list(q: AuditQuery): Promise<AuditRow[]>
  }
  levels: {
    list(): Promise<Level[]>
    save(input: LevelInput): Promise<Role>
    remove(key: Role): Promise<void>
  }
  system: {
    info(): Promise<BackupInfo>
    /** saves a password-protected backup file (database and key); null when the save dialog was cancelled */
    backup(password: string): Promise<string | null>
    /** picks a backup file, checks its password and the administrator's PIN, replaces the data and restarts */
    restoreFile(password: string, pin: string): Promise<boolean>
    /** restores a safety copy kept on this PC and restarts */
    restoreCopy(name: string, pin: string): Promise<void>
    /** deletes every record (visits, register entries, notes, shifts…) but keeps accounts, levels, registers and settings */
    erase(pin: string, includeStudents: boolean): Promise<void>
    /** back to the first start: everything deleted, the program restarts and sets itself up again */
    factoryReset(pin: string): Promise<void>
    openFolder(): Promise<void>
    restart(): Promise<void>
    /** recovery mode only (the data key cannot be opened): restores a backup file, no PIN possible */
    recover(password: string): Promise<boolean>
  }
  users: {
    list(): Promise<User[]>
    create(name: string, role: Role, pin: string, language: Lang): Promise<void>
    update(id: number, patch: { active?: boolean; pin?: string; role?: Role }): Promise<void>
  }
  settings: {
    get(): Promise<Settings>
    set(s: Settings): Promise<void>
    getFeatures(): Promise<Features>
    setFeatures(f: Features): Promise<void>
  }
  scan: {
    analyze(image: Uint8Array, opts?: ScanOptions): Promise<ScanResult>
    readText(image: Uint8Array): Promise<string[]>
    /** fields from the printed text of a card front (Windows OCR, else Tesseract); for cards the machine-readable zone could not read */
    readFront(image: Uint8Array): Promise<ScanResult>
    barcodes(image: Uint8Array): Promise<string[]>
  }
  students: {
    /** search by name (Arabic or Latin, any spelling close enough), card number or ID number; blank = the first 200 */
    list(q: { text: string; includeInactive: boolean }): Promise<StudentMatch[]>
    /** students that could be the person being registered: the same card / ID number first, then alike names */
    suggest(q: { name: string; idNumber: string }): Promise<StudentMatch[]>
    count(): Promise<number>
    save(input: StudentInput): Promise<number>
    setActive(id: number, active: boolean): Promise<void>
    remove(id: number): Promise<void>
    /** picks an Excel or CSV file and adds or updates the students in it */
    import(): Promise<StudentImportResult | null>
    /** saves an empty Excel file with the right columns */
    template(lang: Lang): Promise<string | null>
    pdf(q: { text: string; includeInactive: boolean }, lang: Lang): Promise<string | null>
  }
  exports: {
    pdf(range: ExportRange): Promise<string | null>
    excel(range: ExportRange): Promise<string | null>
    /** A4 PDFs with the faculty header; each returns the saved path, or null when the save dialog was cancelled */
    registerPdf(q: EntryQuery, lang: Lang): Promise<string | null>
    entryPdf(entryId: number, lang: Lang): Promise<string | null>
    auditPdf(q: AuditQuery, lang: Lang): Promise<string | null>
    visitPdf(visitId: number, lang: Lang): Promise<string | null>
    evacuation(lang: Lang): Promise<string>
    shiftReport(shiftId: number, lang: Lang): Promise<string | null>
  }
  vehicles: {
    lookup(plate: string): Promise<VehicleLookup | null>
    checkIn(input: VehicleInInput): Promise<number>
    checkOut(id: number, note: string): Promise<void>
    inside(): Promise<VehicleRow[]>
    search(q: RangeQuery): Promise<VehicleRow[]>
    photo(id: number): Promise<Uint8Array | null>
  }
  deliveries: {
    add(input: DeliveryInput): Promise<number>
    pickUp(id: number, by: string): Promise<void>
    waiting(): Promise<DeliveryRow[]>
    search(q: RangeQuery): Promise<DeliveryRow[]>
    photo(id: number): Promise<Uint8Array | null>
    recipients(): Promise<string[]>
  }
  incidents: {
    add(input: IncidentInput): Promise<number>
    close(id: number, resolution: string): Promise<void>
    open(): Promise<IncidentRow[]>
    search(q: RangeQuery): Promise<IncidentRow[]>
    get(id: number): Promise<IncidentDetail>
  }
  shifts: {
    state(): Promise<ShiftState>
    start(): Promise<ShiftRow>
    end(handoverNote: string): Promise<ShiftRow>
    activity(from: string, to: string | null): Promise<ActivityItem[]>
    list(q: RangeQuery): Promise<ShiftRow[]>
  }
  patrols: {
    checkpoints(includeInactive: boolean): Promise<Checkpoint[]>
    addCheckpoint(name: string, location: string): Promise<void>
    updateCheckpoint(id: number, patch: { name?: string; location?: string; active?: boolean }): Promise<void>
    labelsPdf(lang: Lang): Promise<string | null>
    current(): Promise<PatrolRoundDetail | null>
    start(): Promise<PatrolRoundDetail>
    check(roundId: number, checkpointId: number, status: CheckStatus, note: string, method: 'manual' | 'qr'): Promise<PatrolRoundDetail>
    findByCode(code: string): Promise<Checkpoint | null>
    finish(roundId: number, note: string): Promise<void>
    list(q: RangeQuery): Promise<PatrolRound[]>
    get(id: number): Promise<PatrolRoundDetail>
  }
  keys: {
    items(includeInactive: boolean): Promise<KeyItem[]>
    addItem(input: KeyItemInput): Promise<void>
    setActive(id: number, active: boolean): Promise<void>
    lend(itemId: number, input: LendInput): Promise<void>
    giveBack(loanId: number, note: string): Promise<void>
    loans(q: RangeQuery): Promise<KeyLoan[]>
  }
  alerts: {
    list(): Promise<AlertItem[]>
  }
  customFields: {
    list(includeInactive: boolean): Promise<CustomField[]>
    add(input: CustomFieldInput): Promise<void>
    update(id: number, patch: Partial<CustomFieldInput> & { active?: boolean }): Promise<void>
  }
  expected: {
    list(): Promise<ExpectedVisitor[]>
    add(input: ExpectedInput): Promise<void>
    cancel(id: number): Promise<void>
    findByRef(ref: string): Promise<ExpectedVisitor | null>
  }
  sync: {
    status(): Promise<SyncStatus>
    connect(url: string, code: string, deviceName: string): Promise<SyncStatus>
    disconnect(): Promise<void>
    now(): Promise<SyncStatus>
  }
  badges: {
    settings(): Promise<BadgeSettings>
    setSettings(s: BadgeSettings): Promise<void>
    printers(): Promise<string[]>
    print(visitId: number): Promise<void>
    /** PNG data URL of the badge, with unsaved settings */
    preview(visitId: number, settings: BadgeSettings): Promise<string>
  }
  watchlist: {
    check(q: { idNumber?: string; name?: string; plate?: string }): Promise<WatchHit[]>
    list(): Promise<WatchRow[]>
    add(input: WatchInput): Promise<void>
    setActive(id: number, active: boolean): Promise<void>
  }
}
