// Contract between a post (desktop app), the server and the dashboard.
// Only what supervisors need travels: no photos, ID numbers are masked.

export type SyncEntity = 'visit' | 'vehicle' | 'delivery' | 'incident' | 'note' | 'shift' | 'patrol' | 'key_loan' | 'expected'

export const SYNC_ENTITIES: SyncEntity[] = ['visit', 'vehicle', 'delivery', 'incident', 'note', 'shift', 'patrol', 'key_loan', 'expected']

/** A custom field value, with its label in the three languages (the server does not know the site's field definitions) */
export interface SyncCustom { labels: { ar: string; en: string; fr: string }; value: string }

export interface SyncVisit {
  fullName: string; fullNameAlt: string; idType: string; idMasked: string; company: string; host: string; purpose: string
  badgeNo: string; vehiclePlate: string; notes: string; timeIn: string; timeOut: string | null; guardIn: string; guardOut: string | null
  custom: SyncCustom[]
}
export interface SyncVehicle {
  plate: string; vehicleType: string; color: string; driverName: string; company: string; passengers: number; cargo: string; notes: string
  timeIn: string; timeOut: string | null; guardIn: string; guardOut: string | null; custom: SyncCustom[]
}
export interface SyncDelivery {
  recipient: string; carrier: string; courierName: string; parcels: number; tracking: string; notes: string; time: string
  guard: string; pickedUpAt: string | null; pickedUpBy: string; custom: SyncCustom[]
}
export interface SyncIncident {
  type: string; severity: string; occurredAt: string; location: string; description: string; peopleInvolved: string
  actionTaken: string; guard: string; closedAt: string | null; closedBy: string | null; resolution: string; photoCount: number
}
export interface SyncNote { time: string; category: string; text: string; guard: string }
export interface SyncShift { guard: string; startedAt: string; endedAt: string | null; handoverNote: string; acknowledgedBy: string | null }
export interface SyncPatrol {
  guard: string; startedAt: string; endedAt: string | null; note: string; total: number; done: number; issues: number
  checks: { name: string; status: string | null; note: string; time: string | null }[]
}
export interface SyncKeyLoan {
  itemLabel: string; borrower: string; borrowerInfo: string; outAt: string; dueAt: string | null; returnedAt: string | null
  guardOut: string; guardIn: string | null; notes: string
}
/** expected visitor created on the post itself (those created in the dashboard live on the server) */
export interface SyncExpected {
  refCode: string; fullName: string; company: string; host: string; purpose: string; validFrom: string; validTo: string
  status: string; arrivedAt: string | null
}

export interface SyncRecord {
  entity: SyncEntity
  localId: number
  /** main date of the record, for sorting and retention */
  time: string
  data: unknown
}

export interface SyncArrival { preregId: number; arrivedAt: string; visitLocalId: number | null }

export interface SyncRequest {
  appVersion: string
  records: SyncRecord[]
  arrivals: SyncArrival[]
}

export interface ServerWatchEntry {
  id: number; name: string; idNumber: string; plate: string; reason: string; level: 'deny' | 'alert'; active: boolean
}

export interface ServerExpected {
  id: number; refCode: string; fullName: string; company: string; host: string; purpose: string; phone: string
  validFrom: string; validTo: string; notes: string; status: 'pending' | 'arrived' | 'cancelled'
}

export interface SyncResponse {
  serverTime: string
  siteName: string
  watchlist: ServerWatchEntry[]
  expected: ServerExpected[]
}

export interface EnrollRequest { code: string; deviceName: string; appVersion: string }
export interface EnrollResponse { token: string; deviceId: number; siteId: number; siteName: string }

/** QR prefixes: checkpoint labels, pre-registration passes, visitor badges */
export const QR_PREREG = 'SECREG-P:'
export const QR_BADGE = 'SECREG-V:'

/** "AB12345678" -> "••••5678" */
export const maskId = (id: string): string => (id ? `••••${id.slice(-4)}` : '')
