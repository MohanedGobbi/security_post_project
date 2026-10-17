import type { Features, Module, ProfileId, ShiftSummary } from './types'

export const MODULES: Module[] = ['vehicles', 'deliveries', 'incidents', 'patrols', 'keys', 'notes', 'watchlist', 'shifts', 'preregistration', 'badges']

const modules = (on: Module[]): Record<Module, boolean> =>
  Object.fromEntries(MODULES.map((m) => [m, on.includes(m)])) as Record<Module, boolean>

/** Starting points offered at first setup; every switch can then be changed in Settings → Features. */
export const PROFILES: Record<ProfileId, Features> = {
  // one entrance, one guard: visitors and a simple logbook
  small: {
    modules: modules(['notes']),
    idScan: true, visitorPhoto: false, requireIdNumber: true, badgeNumbers: false
  },
  // company site: cars and deliveries at the gate, several guards taking turns
  company: {
    modules: modules(['vehicles', 'deliveries', 'incidents', 'notes', 'watchlist', 'shifts', 'preregistration', 'badges']),
    idScan: true, visitorPhoto: true, requireIdNumber: true, badgeNumbers: true
  },
  // university, hospital, large site: everything
  large: {
    modules: modules(MODULES),
    idScan: true, visitorPhoto: true, requireIdNumber: true, badgeNumbers: true
  }
}

/** Installations made before feature switches existed keep everything on. */
export const ALL_ON: Features = PROFILES.large

/**
 * Never configured (older installation): everything on.
 * Configured: a module added by a later version stays off until the administrator switches it on.
 */
export function normalizeFeatures(f: Partial<Features> | null | undefined): Features {
  const missingModule = f ? false : true
  return {
    modules: { ...(Object.fromEntries(MODULES.map((m) => [m, missingModule])) as Record<Module, boolean>), ...(f?.modules ?? {}) },
    idScan: f?.idScan ?? ALL_ON.idScan,
    visitorPhoto: f?.visitorPhoto ?? ALL_ON.visitorPhoto,
    requireIdNumber: f?.requireIdNumber ?? ALL_ON.requireIdNumber,
    badgeNumbers: f?.badgeNumbers ?? ALL_ON.badgeNumbers
  }
}

/** The profile these switches correspond to exactly, if any. */
export function matchingProfile(f: Features): ProfileId | null {
  return (Object.keys(PROFILES) as ProfileId[]).find((id) => JSON.stringify(PROFILES[id]) === JSON.stringify(normalizeFeatures(f))) ?? null
}

/** Which module each shift-summary counter belongs to (counters without one are always shown) */
export const SUMMARY_MODULE: Partial<Record<keyof ShiftSummary, Module>> = {
  vehiclesIn: 'vehicles', vehiclesOut: 'vehicles', vehiclesInside: 'vehicles',
  parcelsReceived: 'deliveries', parcelsPickedUp: 'deliveries', parcelsWaiting: 'deliveries',
  incidents: 'incidents', openIncidents: 'incidents', notes: 'notes', patrols: 'patrols', keysOut: 'keys'
}

export const summaryKeyOn = (k: keyof ShiftSummary, f: Features): boolean => {
  const m = SUMMARY_MODULE[k]
  return !m || f.modules[m]
}
