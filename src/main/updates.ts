// Automatic updates, the program's side (Linux, .deb install). The program never runs anything as root: the updater
// (scripts/linux/updater/update.sh, a root systemd service) installs releases, and this module only
//   - reads its status.json and the version file of the installed package,
//   - drops a request file in a folder the program's user owns (a systemd .path unit starts the updater on it),
//   - writes running.json in the data folder once the window has loaded: the updater's health check.
// Only node: built-ins here, so the tests run it with plain `node --test`.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { UpdateInfo, UpdateState, UpdateStatus } from '@shared/types'

/** Where the updater keeps its status and the request folder (SECREG_UPDATE_DIR changes it, for the tests) */
export const updateDir = (): string => process.env['SECREG_UPDATE_DIR'] || '/var/lib/faculty-security-update'

const STATES: readonly UpdateState[] = ['checking', 'up_to_date', 'downloading', 'installing', 'updated', 'failed', 'skipped', 'error']

export interface VersionFile { version: string; commit: string | null; built: string | null }

/** resources/version.json written when the package was built; null in development or when unreadable */
export function readVersionFile(resourcesDir: string): VersionFile | null {
  try {
    const v = JSON.parse(readFileSync(join(resourcesDir, 'version.json'), 'utf8')) as Record<string, unknown>
    if (typeof v['version'] !== 'string' || !v['version']) return null
    return {
      version: v['version'],
      commit: typeof v['commit'] === 'string' ? v['commit'] : null,
      built: typeof v['built'] === 'string' ? v['built'] : null
    }
  } catch {
    return null
  }
}

const text = (v: unknown, max = 500): string | null => (typeof v === 'string' && v ? v.slice(0, max) : null)

/** the updater's status.json; unknown states, missing or garbled files give null */
export function readStatus(dir = updateDir()): UpdateStatus | null {
  try {
    const raw = JSON.parse(readFileSync(join(dir, 'status.json'), 'utf8')) as Record<string, unknown>
    if (!raw || typeof raw !== 'object') return null
    const state = raw['state']
    if (typeof state !== 'string' || !STATES.includes(state as UpdateState)) return null
    const timestamp = text(raw['timestamp'], 40)
    if (!timestamp || Number.isNaN(Date.parse(timestamp))) return null
    return { state: state as UpdateState, installed: text(raw['installed'], 40), latest: text(raw['latest'], 40), message: text(raw['message']) ?? '', timestamp }
  } catch {
    return null
  }
}

/** what Administration > System shows */
export function updateInfo(installed: VersionFile, dir = updateDir()): UpdateInfo {
  const requests = join(dir, 'request')
  const enabled = existsSync(requests)
  return {
    installed: installed.version,
    commit: installed.commit,
    built: installed.built,
    enabled,
    pending: enabled && existsSync(join(requests, 'check-now')),
    status: enabled ? readStatus(dir) : null
  }
}

export interface RequestContext {
  isAdmin: boolean
  /** throws when the administrator's PIN typed again is wrong (shared lock-out with the login) */
  checkPin(): void
  /** a demonstration copy never asks the PC to update itself */
  demo: boolean
  by: string
}

/** "Check for updates now": only a file in the request folder; the .path unit starts the updater as root */
export function requestUpdateCheck(ctx: RequestContext, dir = updateDir()): void {
  if (!ctx.isAdmin) throw new Error('error.forbidden')
  if (ctx.demo) throw new Error('error.demoRefused')
  ctx.checkPin()
  const requests = join(dir, 'request')
  if (!existsSync(requests)) throw new Error('error.updatesOff')
  const file = join(requests, 'check-now')
  const tmp = join(requests, `.check-now.${process.pid}`)
  writeFileSync(tmp, JSON.stringify({ requestedAt: new Date().toISOString(), by: ctx.by }) + '\n', { mode: 0o644 })
  renameSync(tmp, file)
}

/** running.json in the data folder: the updater waits for it after installing a version */
export function writeRunningMarker(dataDir: string, version: string, state: 'ok' | 'recovery'): void {
  try {
    const tmp = join(dataDir, `.running.${process.pid}.json`)
    writeFileSync(tmp, JSON.stringify({ version, state, pid: process.pid, startedAt: new Date().toISOString() }) + '\n')
    renameSync(tmp, join(dataDir, 'running.json'))
  } catch {
    // a read-only or missing data folder only means no health report
  }
}
