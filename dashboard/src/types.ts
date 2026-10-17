import type { SyncEntity } from '@shared/sync'
import type { Lang } from '@shared/types'

export type Role = 'owner' | 'supervisor' | 'host'

export interface Me { id: number; email: string; name: string; role: Role; language: Lang; siteIds: number[] | null }

export interface Site { id: number; name: string; address: string; active: boolean }

export interface Device {
  id: number; siteId: number; siteName: string; name: string; appVersion: string; createdAt: string
  lastSeen: string | null; revoked: boolean; online: boolean
}

export interface SiteOverview {
  id: number; name: string; address: string
  devices: { id: number; name: string; lastSeen: string | null; online: boolean }[]
  insideNow: number; vehiclesInside: number; openIncidents: number; keysOut: number; parcelsWaiting: number
  expectedToday: number; visitsToday: number
}

export interface RecordRow {
  entity: SyncEntity; localId: number; siteId: number; siteName: string; device: string; time: string
  data: Record<string, unknown>
}

export interface ActivityEvent { time: string; kind: string; site: string; title: string; detail: string; guard: string }

export interface Prereg {
  id: number; siteId: number; siteName: string; refCode: string; fullName: string; company: string; host: string; purpose: string
  phone: string; email: string; validFrom: string; validTo: string; notes: string; status: 'pending' | 'arrived' | 'cancelled'
  arrivedAt: string | null; createdBy: string | null; createdAt: string
}

export interface WatchEntry {
  id: number; name: string; idNumber: string; plate: string; reason: string; level: 'deny' | 'alert'; active: boolean
  createdBy: string | null; createdAt: string
}

export interface DashUser extends Me { active: boolean; createdAt: string }
