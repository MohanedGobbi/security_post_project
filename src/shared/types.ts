export type Lang = 'ar' | 'en' | 'fr'
/** leader = head of a guard team (رئيس فرقة الأمن) */
export type Role = 'admin' | 'leader' | 'guard'

export interface User {
  id: number
  name: string
  role: Role
  language: Lang
  active: boolean
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
  needsSetup: boolean
  user: User | null
  siteName: string
  features: Features
}

export interface SetupInput {
  siteName: string
  postName: string
  adminName: string
  pin: string
  language: Lang
  profile: ProfileId
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

export interface CheckInInput extends PersonFields {
  host: string
  purpose: string
  badgeNo: string
  vehiclePlate: string
  notes: string
  /** JPEG bytes of the visitor photo taken at the desk */
  photo: Uint8Array | null
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
  custom: CustomValues
}

export interface VisitDetail extends VisitRow {
  nationality: string
  birthDate: string
  sex: string
  phone: string
  photo: Uint8Array | null
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

export interface ScanResult {
  source: 'mrz' | 'barcode' | 'none'
  fields: Partial<PersonFields>
  /** check digits all valid (MRZ only) */
  valid: boolean
  rawMrz: string[]
  barcodes: { format: string; text: string }[]
  /** text lines read from the card when the MRZ could not be fully read */
  lines: string[]
}

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
    setup(input: SetupInput): Promise<User>
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
    analyze(image: Uint8Array): Promise<ScanResult>
    readText(image: Uint8Array): Promise<string[]>
    barcodes(image: Uint8Array): Promise<string[]>
  }
  exports: {
    pdf(range: ExportRange): Promise<string | null>
    excel(range: ExportRange): Promise<string | null>
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
