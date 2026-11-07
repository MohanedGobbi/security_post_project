import type { EquipmentItem, User } from '@shared/types'
import { audit, conn, now } from './db'

/**
 * The equipment of the security office (radios, keys, detectors, torches…). The team leader checks each item present at the
 * start of every shift, in the equipment_check register; team leaders and administrators add and remove items.
 */

const clean = (s: unknown, max = 120): string => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

export function listEquipment(): EquipmentItem[] {
  return conn().prepare('SELECT id, name, quantity FROM equipment WHERE active = 1 ORDER BY name').all() as unknown as EquipmentItem[]
}

export function addEquipment(input: { name: string; quantity: number }, user: User): number {
  const name = clean(input.name)
  if (!name) throw new Error('error.nameRequired')
  const quantity = Math.max(1, Math.min(9999, Math.round(Number(input.quantity) || 1)))
  const db = conn()
  if (db.prepare('SELECT id FROM equipment WHERE active = 1 AND lower(name) = lower(?)').get(name)) throw new Error('error.equipmentExists')
  const id = Number(db.prepare('INSERT INTO equipment (name, quantity, created_by, created_at) VALUES (?, ?, ?, ?)').run(name, quantity, user.id, now()).lastInsertRowid)
  audit(user.id, 'equipment_added', 'equipment', id, `${name} × ${quantity}`)
  return id
}

/** The first list, once: later the team leaders and administrators keep it up to date (a removed item is not brought back). */
export function seedEquipment(items: [string, number][], userId: number): void {
  const db = conn()
  if (db.prepare("SELECT 1 FROM settings WHERE key = 'equipmentSeeded'").get()) return
  const add = db.prepare('INSERT INTO equipment (name, quantity, created_by, created_at) VALUES (?, ?, ?, ?)')
  if (!(db.prepare('SELECT COUNT(*) AS n FROM equipment').get() as { n: number }).n) for (const [name, q] of items) add.run(name, q, userId, now())
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('equipmentSeeded', '1')").run()
}

/** Takes an item off the list; it stays in the database, marked removed, with who did it. */
export function removeEquipment(id: number, user: User): void {
  const row = conn().prepare('SELECT name FROM equipment WHERE id = ? AND active = 1').get(id) as { name: string } | undefined
  if (!row) throw new Error('error.notFound')
  conn().prepare('UPDATE equipment SET active = 0, removed_by = ?, removed_at = ? WHERE id = ?').run(user.id, now(), id)
  audit(user.id, 'equipment_removed', 'equipment', id, row.name)
}
