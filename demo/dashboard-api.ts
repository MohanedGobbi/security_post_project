// The dashboard demo answers its /api/* calls here instead of the server.
// Site 1 shows the live data of the reception demo (same browser storage); sites 2 and 3 are sample data.
import type { Lang } from '@shared/types'
import { maskId, QR_PREREG } from '@shared/sync'
import { db, dayBounds, nextId, nowIso, refresh, save, today, wait, type DDashUser, type DExpected, type DOtherRecord } from './store'
import { qrSvg } from './qr'

/** Same shape as the server's JSON errors: { status, code } */
export class DemoHttpError extends Error {
  status: number
  code: string
  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}
const err = (status: number, code: string): never => {
  throw new DemoHttpError(status, code)
}

const ONLINE_MS = 3 * 60000

function me(): DDashUser {
  const u = db().dashUsers.find((x) => x.id === db().dashUserId && x.active)
  if (!u) err(401, 'login_required')
  return u as DDashUser
}
const role = (...roles: DDashUser['role'][]): DDashUser => {
  const u = me()
  if (!roles.includes(u.role)) err(403, 'forbidden')
  return u
}
const canSee = (u: DDashUser, siteId: number): boolean => u.siteIds === null || u.siteIds.includes(siteId)
const meJson = (u: DDashUser) => ({ id: u.id, email: u.email, name: u.name, role: u.role, language: u.language, siteIds: u.siteIds })

/** The reception demo's records (site 1), converted like the desktop sync does */
function site1Records(): DOtherRecord[] {
  const s = db()
  const dev = s.sync.deviceName || 'Entrée principale'
  const r = (entity: string, localId: number, time: string, data: Record<string, unknown>): DOtherRecord => ({ entity, localId, siteId: 1, device: dev, time, data })
  const custom = (values: Record<string, string>) => s.customFields.filter((f) => values[String(f.id)]).map((f) => ({ labels: f.labels, value: values[String(f.id)] }))
  return [
    ...s.visits.map((v) => r('visit', v.id, v.timeIn, {
      fullName: v.fullName, fullNameAlt: v.fullNameAlt, idType: v.idType, idMasked: maskId(v.idNumber), company: v.company, host: v.host, purpose: v.purpose,
      badgeNo: v.badgeNo, vehiclePlate: v.vehiclePlate, notes: v.notes, timeIn: v.timeIn, timeOut: v.timeOut, guardIn: v.guardIn, guardOut: v.guardOut, custom: custom(v.custom)
    })),
    ...s.vehicles.map((v) => r('vehicle', v.id, v.timeIn, { ...v, custom: custom(v.custom) })),
    ...s.deliveries.map((d) => r('delivery', d.id, d.time, { ...d, custom: custom(d.custom) })),
    ...s.incidents.map((i) => r('incident', i.id, i.occurredAt, { ...i })),
    ...s.notes.map((n) => r('note', n.id, n.time, { ...n })),
    ...s.shifts.map((x) => r('shift', x.id, x.startedAt, { ...x })),
    ...s.rounds.map((x) => {
      const cps = s.checkpoints.filter((c) => c.active)
      return r('patrol', x.id, x.startedAt, { guard: x.guard, startedAt: x.startedAt, endedAt: x.endedAt, note: x.note, total: cps.length, done: x.checks.length,
        issues: x.checks.filter((c) => c.status === 'issue').length,
        checks: x.checks.map((c) => ({ name: s.checkpoints.find((k) => k.id === c.checkpointId)?.name ?? '', status: c.status, note: c.note, time: c.time })) })
    }),
    ...s.loans.map((l) => r('key_loan', l.id, l.outAt, { ...l, itemLabel: s.keyItems.find((k) => k.id === l.itemId)?.label ?? '' }))
  ]
}

const allRecords = (): DOtherRecord[] => [...(db().sync.configured ? site1Records() : []), ...db().other]

function devices() {
  const s = db()
  return s.devices.map((d) => {
    // the reception demo "syncs" while it is linked
    const lastSeen = d.siteId === 1 ? (s.sync.configured ? nowIso() : d.lastSeen) : d.siteId === 2 ? nowIso() : d.lastSeen
    return { ...d, siteName: s.sites.find((x) => x.id === d.siteId)?.name ?? '', lastSeen, online: !!lastSeen && !d.revoked && Date.now() - Date.parse(lastSeen) < ONLINE_MS }
  })
}

const preregJson = (p: DExpected) => ({
  id: p.id, siteId: p.siteId, siteName: db().sites.find((x) => x.id === p.siteId)?.name ?? '', refCode: p.refCode, fullName: p.fullName, company: p.company,
  host: p.host, purpose: p.purpose, phone: p.phone, email: p.email, validFrom: p.validFrom, validTo: p.validTo, notes: p.notes, status: p.status,
  arrivedAt: p.arrivedAt, createdBy: p.createdBy, createdAt: p.createdAt
})

const newCode = (n: number): string => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join('')
}

type Body = Record<string, unknown>

export async function demoFetch(method: string, path: string, body: unknown): Promise<unknown> {
  await wait(90)
  refresh()
  const s = db()
  const url = new URL(path, 'http://demo')
  const q = url.searchParams
  const parts = url.pathname.split('/').filter(Boolean).slice(1) // after "api"
  const b = (body ?? {}) as Body
  const key = `${method} /${parts.map((p, i) => (/^\d+$/.test(p) && i > 0 ? ':id' : p)).join('/')}`
  const id = Number(parts.find((p) => /^\d+$/.test(p)))
  const done = <T>(v: T): T => {
    save()
    return v
  }

  switch (key) {
    case 'GET /setup': return { needsSetup: false }
    case 'POST /login': {
      const u = s.dashUsers.find((x) => x.email.toLowerCase() === String(b.email ?? '').trim().toLowerCase() && x.active)
      if (!u || u.password !== b.password) err(401, 'bad_credentials')
      s.dashUserId = (u as DDashUser).id
      return done(meJson(u as DDashUser))
    }
    case 'POST /logout': s.dashUserId = null; return done({ ok: true })
    case 'GET /me': return meJson(me())
    case 'PATCH /me': {
      const u = me()
      if (b.language) u.language = b.language as Lang
      if (b.password) {
        if (String(b.password).length < 8) err(400, 'password_short')
        u.password = String(b.password)
      }
      return done({ ok: true })
    }

    case 'GET /sites': {
      const u = me()
      return s.sites.filter((x) => canSee(u, x.id))
    }
    case 'POST /sites': {
      role('owner')
      if (!String(b.name ?? '').trim()) err(400, 'name_required')
      s.sites.push({ id: nextId(), name: String(b.name).trim(), address: String(b.address ?? ''), active: true })
      return done({ ok: true })
    }
    case 'PATCH /sites/:id': {
      role('owner')
      Object.assign(s.sites.find((x) => x.id === id) ?? {}, Object.fromEntries(Object.entries(b).filter(([k]) => ['name', 'address', 'active'].includes(k))))
      return done({ ok: true })
    }
    case 'POST /sites/:id/enroll-code':
      role('owner')
      return { code: newCode(8), expiresAt: new Date(Date.now() + 86400000).toISOString() }
    case 'GET /devices': {
      const u = role('owner', 'supervisor')
      return devices().filter((d) => canSee(u, d.siteId))
    }
    case 'POST /devices/:id/revoke': {
      role('owner')
      Object.assign(s.devices.find((d) => d.id === id) ?? {}, { revoked: true })
      if (id === 1) s.sync.configured = false
      return done({ ok: true })
    }

    case 'GET /overview': {
      const u = role('owner', 'supervisor')
      const recs = allRecords()
      const t = today()
      const [start] = dayBounds(t, t)
      return s.sites.filter((x) => x.active && canSee(u, x.id)).map((site) => {
        const of = (entity: string) => recs.filter((r) => r.siteId === site.id && r.entity === entity)
        return {
          id: site.id, name: site.name, address: site.address,
          devices: devices().filter((d) => d.siteId === site.id && !d.revoked).map((d) => ({ id: d.id, name: d.name, lastSeen: d.lastSeen, online: d.online })),
          insideNow: of('visit').filter((r) => !r.data.timeOut).length,
          vehiclesInside: of('vehicle').filter((r) => !r.data.timeOut).length,
          openIncidents: of('incident').filter((r) => !r.data.closedAt).length,
          keysOut: of('key_loan').filter((r) => !r.data.returnedAt).length,
          parcelsWaiting: of('delivery').filter((r) => !r.data.pickedUpAt).reduce((n, r) => n + Number(r.data.parcels ?? 1), 0),
          expectedToday: s.expected.filter((e) => e.siteId === site.id && e.status === 'pending' && e.validFrom <= t && e.validTo >= t).length,
          visitsToday: of('visit').filter((r) => r.time >= start).length
        }
      })
    }
    case 'GET /inside': {
      const u = role('owner', 'supervisor')
      const site = Number(q.get('site'))
      return allRecords().filter((r) => r.entity === 'visit' && !r.data.timeOut && canSee(u, r.siteId) && (!site || r.siteId === site))
        .map((r) => ({ ...r, siteName: s.sites.find((x) => x.id === r.siteId)?.name ?? '' }))
    }
    case 'GET /records': {
      const u = role('owner', 'supervisor')
      const site = Number(q.get('site'))
      const [from, to] = dayBounds(q.get('from') ?? today(), q.get('to') ?? today())
      const text = (q.get('q') ?? '').toLowerCase()
      return allRecords()
        .filter((r) => r.entity === q.get('entity') && canSee(u, r.siteId) && (!site || r.siteId === site) && r.time >= from && r.time <= to)
        .filter((r) => !text || JSON.stringify(r.data).toLowerCase().includes(text))
        .sort((a, c) => (a.time < c.time ? 1 : -1))
        .map((r) => ({ ...r, siteName: s.sites.find((x) => x.id === r.siteId)?.name ?? '' }))
    }
    case 'GET /activity': {
      const u = role('owner', 'supervisor')
      const [from, to] = dayBounds(q.get('from') ?? today(), q.get('to') ?? today())
      const events: { time: string; kind: string; site: string; title: string; detail: string; guard: string }[] = []
      for (const r of allRecords().filter((x) => canSee(u, x.siteId))) {
        const d = r.data
        const site = s.sites.find((x) => x.id === r.siteId)?.name ?? ''
        const push = (time: unknown, kind: string, title: unknown, detail: unknown, guard: unknown): void => {
          if (typeof time === 'string' && time >= from && time <= to) events.push({ time, kind, site, title: String(title ?? ''), detail: String(detail ?? ''), guard: String(guard ?? '') })
        }
        switch (r.entity) {
          case 'visit': push(d.timeIn, 'visit_in', d.fullName, d.host, d.guardIn); push(d.timeOut, 'visit_out', d.fullName, d.notes, d.guardOut); break
          case 'vehicle': push(d.timeIn, 'vehicle_in', d.plate, d.driverName, d.guardIn); push(d.timeOut, 'vehicle_out', d.plate, d.driverName, d.guardOut); break
          case 'delivery': push(d.time, 'delivery', d.recipient, `${d.carrier} ×${d.parcels}`, d.guard); push(d.pickedUpAt, 'pickup', d.recipient, d.pickedUpBy, ''); break
          case 'incident': push(d.occurredAt, 'incident', d.type, d.description, d.guard); push(d.closedAt, 'incident_closed', d.type, d.resolution, d.closedBy); break
          case 'note': push(d.time, 'note', d.category, d.text, d.guard); break
          case 'shift': push(d.startedAt, 'shift_start', d.guard, '', d.guard); push(d.endedAt, 'shift_end', d.guard, d.handoverNote, d.guard); break
          case 'patrol': push(d.endedAt, 'patrol', `${d.done} / ${d.total}`, d.note, d.guard); break
          case 'key_loan': push(d.outAt, 'key_out', d.itemLabel, d.borrower, d.guardOut); push(d.returnedAt, 'key_in', d.itemLabel, d.borrower, d.guardIn); break
        }
      }
      return events.sort((a, c) => (a.time < c.time ? 1 : -1)).slice(0, 500)
    }

    case 'GET /prereg': {
      const u = me()
      const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
      return s.expected.filter((e) => canSee(u, e.siteId) && e.validTo >= since && (u.role !== 'host' || e.createdBy === u.name))
        .sort((a, c) => a.validFrom.localeCompare(c.validFrom)).map(preregJson)
    }
    case 'POST /prereg': {
      const u = me()
      const siteId = Number(b.siteId)
      if (!canSee(u, siteId)) err(403, 'forbidden')
      if (!String(b.fullName ?? '').trim()) err(400, 'name_required')
      const validFrom = String(b.validFrom || today())
      const validTo = String(b.validTo || validFrom)
      if (validTo < validFrom) err(400, 'bad_dates')
      const e: DExpected = {
        id: nextId(), refCode: newCode(6), fullName: String(b.fullName).trim(), company: String(b.company ?? ''), host: String(b.host || u.name),
        purpose: String(b.purpose ?? ''), phone: String(b.phone ?? ''), validFrom, validTo, notes: String(b.notes ?? ''), status: 'pending', source: 'server',
        arrivedAt: null, visitId: null, siteId, createdBy: u.name, email: String(b.email ?? ''), createdAt: nowIso()
      }
      s.expected.push(e)
      return done({ id: e.id, refCode: e.refCode })
    }
    case 'PATCH /prereg/:id': {
      me()
      const e = s.expected.find((x) => x.id === id)
      if (e && b.status === 'cancelled' && e.status === 'pending') e.status = 'cancelled'
      return done({ ok: true })
    }

    case 'GET /watchlist':
      role('owner', 'supervisor')
      return s.watch.filter((w) => w.org).map((w) => ({ id: w.id, name: w.name, idNumber: w.idNumber, plate: w.plate, reason: w.reason, level: w.level,
        active: w.active, createdBy: w.addedBy, createdAt: w.createdAt }))
    case 'POST /watchlist': {
      const u = role('owner', 'supervisor')
      if (!b.name && !b.idNumber && !b.plate) err(400, 'watch_target')
      if (!String(b.reason ?? '').trim()) err(400, 'reason_required')
      s.watch.push({ id: nextId(), name: String(b.name ?? ''), idNumber: String(b.idNumber ?? '').toUpperCase().replace(/[\s\-.<\/]/g, ''),
        plate: String(b.plate ?? '').toUpperCase(), reason: String(b.reason), level: b.level === 'alert' ? 'alert' : 'deny', active: true,
        addedBy: u.name, createdAt: nowIso(), org: true })
      return done({ ok: true })
    }
    case 'PATCH /watchlist/:id':
      role('owner', 'supervisor')
      Object.assign(s.watch.find((w) => w.id === id && w.org) ?? {}, { active: !!b.active })
      return done({ ok: true })

    case 'GET /users':
      role('owner')
      return s.dashUsers.map((u) => ({ ...meJson(u), active: u.active, createdAt: u.createdAt }))
    case 'POST /users': {
      role('owner')
      if (!/^\S+@\S+$/.test(String(b.email ?? ''))) err(400, 'bad_email')
      if (s.dashUsers.some((u) => u.email.toLowerCase() === String(b.email).toLowerCase())) err(409, 'email_taken')
      if (String(b.password ?? '').length < 8) err(400, 'password_short')
      const r = (['owner', 'supervisor', 'host'].includes(String(b.role)) ? b.role : 'host') as DDashUser['role']
      s.dashUsers.push({ id: nextId(), email: String(b.email), name: String(b.name || b.email), role: r, password: String(b.password),
        language: (b.language as Lang) ?? 'fr', active: true, siteIds: r === 'owner' ? null : ((b.siteIds as number[]) ?? []), createdAt: nowIso() })
      return done({ ok: true })
    }
    case 'PATCH /users/:id': {
      role('owner')
      const u = s.dashUsers.find((x) => x.id === id)
      if (!u) err(404, 'not_found')
      const target = u as DDashUser
      const owners = s.dashUsers.filter((x) => x.role === 'owner' && x.active).length
      if (target.role === 'owner' && (b.active === false || (b.role && b.role !== 'owner')) && owners <= 1) err(400, 'last_owner')
      if (b.active !== undefined) target.active = !!b.active
      if (b.role) { target.role = b.role as DDashUser['role']; target.siteIds = target.role === 'owner' ? null : target.siteIds ?? [] }
      if (b.siteIds) target.siteIds = b.siteIds as number[]
      if (b.password) target.password = String(b.password)
      return done({ ok: true })
    }

    case 'GET /settings': role('owner'); return { retentionDays: s.retentionDays }
    case 'PUT /settings': role('owner'); s.retentionDays = Number(b.retentionDays) || 365; return done({ ok: true })
  }
  return err(404, 'not_found')
}

/** Pass QR, drawn in the browser */
export async function demoPreregQr(id: number): Promise<string> {
  const e = db().expected.find((x) => x.id === id)
  if (!e) err(404, 'not_found')
  return qrSvg(`${QR_PREREG}${(e as DExpected).refCode}`)
}

