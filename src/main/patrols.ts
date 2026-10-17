import { randomBytes } from 'node:crypto'
import type { Checkpoint, CheckStatus, PatrolCheck, PatrolRound, PatrolRoundDetail, RangeQuery } from '@shared/types'
import { conn, dayEnd, dayStart, now } from './db'

/** Printed in the QR label of each checkpoint */
export const QR_PREFIX = 'SECREG-CP:'

interface CheckpointDb { id: number; name: string; location: string; code: string; active: number }
const toCheckpoint = (r: CheckpointDb): Checkpoint => ({ id: r.id, name: r.name, location: r.location, code: r.code, active: r.active === 1 })

export function listCheckpoints(includeInactive: boolean): Checkpoint[] {
  return (conn().prepare(`SELECT * FROM checkpoints ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY sort, id`).all() as unknown as CheckpointDb[]).map(toCheckpoint)
}

export function addCheckpoint(name: string, location: string): number {
  if (!name.trim()) throw new Error('error.nameRequired')
  const code = randomBytes(4).toString('hex').toUpperCase()
  const r = conn().prepare('INSERT INTO checkpoints (name, location, code, sort) VALUES (?, ?, ?, ?)').run(name.trim(), location.trim(), code, Date.now() % 1e9)
  return Number(r.lastInsertRowid)
}

export function updateCheckpoint(id: number, patch: { name?: string; location?: string; active?: boolean }): void {
  const db = conn()
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error('error.nameRequired')
    db.prepare('UPDATE checkpoints SET name = ? WHERE id = ?').run(patch.name.trim(), id)
  }
  if (patch.location !== undefined) db.prepare('UPDATE checkpoints SET location = ? WHERE id = ?').run(patch.location.trim(), id)
  if (patch.active !== undefined) db.prepare('UPDATE checkpoints SET active = ? WHERE id = ?').run(patch.active ? 1 : 0, id)
}

/** Accepts the raw QR text ("SECREG-CP:1A2B3C4D") or the code typed by hand */
export function findByCode(text: string): Checkpoint | null {
  const code = text.trim().toUpperCase().replace(QR_PREFIX, '')
  const r = conn().prepare('SELECT * FROM checkpoints WHERE code = ? AND active = 1').get(code) as CheckpointDb | undefined
  return r ? toCheckpoint(r) : null
}

interface RoundDb { id: number; guard: string; started_at: string; ended_at: string | null; note: string; done: number; issues: number }

const ROUND_SELECT = `
SELECT r.id, u.name AS guard, r.started_at, r.ended_at, r.note,
  (SELECT COUNT(*) FROM patrol_checks c WHERE c.round_id = r.id) AS done,
  (SELECT COUNT(*) FROM patrol_checks c WHERE c.round_id = r.id AND c.status = 'issue') AS issues
FROM patrol_rounds r JOIN users u ON u.id = r.guard_id`

/** `total` = active checkpoints, plus any visited checkpoint disabled since */
function toRound(r: RoundDb): PatrolRound {
  const total = (conn().prepare(`SELECT COUNT(*) AS n FROM checkpoints c WHERE c.active = 1
    OR c.id IN (SELECT checkpoint_id FROM patrol_checks WHERE round_id = ?)`).get(r.id) as { n: number }).n
  return { id: r.id, guard: r.guard, startedAt: r.started_at, endedAt: r.ended_at, note: r.note, total, done: r.done, issues: r.issues }
}

export function getRound(id: number): PatrolRoundDetail {
  const db = conn()
  const r = db.prepare(`${ROUND_SELECT} WHERE r.id = ?`).get(id) as RoundDb | undefined
  if (!r) throw new Error('error.notFound')
  const checks = db.prepare(`
    SELECT c.id AS checkpoint_id, c.name, c.location, pc.time, pc.status, pc.note, pc.method
    FROM checkpoints c LEFT JOIN patrol_checks pc ON pc.checkpoint_id = c.id AND pc.round_id = ?
    WHERE c.active = 1 OR pc.id IS NOT NULL
    ORDER BY c.sort, c.id`).all(id) as { checkpoint_id: number; name: string; location: string; time: string | null; status: CheckStatus | null; note: string | null; method: string | null }[]
  return {
    ...toRound(r),
    checks: checks.map((c): PatrolCheck => ({
      checkpointId: c.checkpoint_id, name: c.name, location: c.location, time: c.time, status: c.status,
      note: c.note ?? '', method: (c.method as PatrolCheck['method']) ?? ''
    }))
  }
}

export function currentRound(guardId: number): PatrolRoundDetail | null {
  const r = conn().prepare('SELECT id FROM patrol_rounds WHERE guard_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1').get(guardId) as { id: number } | undefined
  return r ? getRound(r.id) : null
}

export function startRound(guardId: number, post: string): PatrolRoundDetail {
  const open = currentRound(guardId)
  if (open) return open
  if (listCheckpoints(false).length === 0) throw new Error('error.noCheckpoints')
  const r = conn().prepare('INSERT INTO patrol_rounds (guard_id, started_at, post) VALUES (?, ?, ?)').run(guardId, now(), post)
  return getRound(Number(r.lastInsertRowid))
}

/** Records (or corrects) the visit of one checkpoint in an open round of this guard */
export function checkPoint(guardId: number, roundId: number, checkpointId: number, status: CheckStatus, note: string, method: 'manual' | 'qr'): PatrolRoundDetail {
  const db = conn()
  const round = db.prepare('SELECT guard_id, ended_at FROM patrol_rounds WHERE id = ?').get(roundId) as { guard_id: number; ended_at: string | null } | undefined
  if (!round || round.guard_id !== guardId) throw new Error('error.notFound')
  if (round.ended_at) throw new Error('error.roundFinished')
  if (status === 'issue' && !note.trim()) throw new Error('error.issueNote')
  db.prepare(`INSERT INTO patrol_checks (round_id, checkpoint_id, time, status, note, method) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(round_id, checkpoint_id) DO UPDATE SET time = excluded.time, status = excluded.status, note = excluded.note, method = excluded.method`)
    .run(roundId, checkpointId, now(), status === 'issue' ? 'issue' : 'ok', note.trim(), method === 'qr' ? 'qr' : 'manual')
  return getRound(roundId)
}

export function finishRound(guardId: number, roundId: number, note: string): void {
  const db = conn()
  const round = db.prepare('SELECT guard_id, ended_at FROM patrol_rounds WHERE id = ?').get(roundId) as { guard_id: number; ended_at: string | null } | undefined
  if (!round || round.guard_id !== guardId) throw new Error('error.notFound')
  if (round.ended_at) throw new Error('error.roundFinished')
  db.prepare('UPDATE patrol_rounds SET ended_at = ?, note = ? WHERE id = ?').run(now(), note.trim(), roundId)
}

export function listRounds(q: RangeQuery): PatrolRound[] {
  const params: string[] = [dayStart(q.from), dayEnd(q.to)]
  let extra = ''
  if (q.text.trim()) {
    extra = ' AND (u.name LIKE ? OR r.note LIKE ? OR r.id IN (SELECT round_id FROM patrol_checks WHERE note LIKE ?))'
    const like = `%${q.text.trim()}%`
    params.push(like, like, like)
  }
  return (conn().prepare(`${ROUND_SELECT} WHERE r.started_at BETWEEN ? AND ?${extra} ORDER BY r.started_at DESC LIMIT 2000`).all(...params) as unknown as RoundDb[]).map(toRound)
}

/** When the last round was finished (null = never) */
export function lastRoundEnd(): string | null {
  return (conn().prepare('SELECT MAX(ended_at) AS t FROM patrol_rounds').get() as { t: string | null }).t
}
