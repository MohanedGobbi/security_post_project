import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { EquipmentItem, RegisterDef } from '@shared/types'
import Icon from './Icon'
import { errorText } from '../util'

type Mark = { present: boolean | null; note: string }

/**
 * The equipment of the security office. In a handover (`reg` given) the team leader ticks each item present or missing,
 * with a note for what is missing, and records the check in the equipment_check register. Items can be added and removed
 * here, in the handover itself or in Administration.
 */
export default function EquipmentCheck({ reg, onSaved, toast, children }: {
  /** the equipment_check register: without it, the list is only managed (Administration) */
  reg?: RegisterDef
  onSaved?(number: number): void
  toast(text: string, kind?: 'ok' | 'error'): void
  /** extra buttons next to the record button (Back) */
  children?: ReactNode
}): ReactNode {
  const { t } = useTranslation()
  const [items, setItems] = useState<EquipmentItem[] | null>(null)
  const [marks, setMarks] = useState<Record<number, Mark>>({})
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const checking = !!reg

  const load = useCallback(() => {
    window.api.equipment.list().then(setItems).catch((e) => toast(errorText(e, t), 'error'))
  }, [toast, t])
  useEffect(load, [load])

  const mark = (id: number, patch: Partial<Mark>): void =>
    setMarks((cur) => ({ ...cur, [id]: { ...(cur[id] ?? { present: null, note: '' }), ...patch } }))

  const add = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await window.api.equipment.add({ name, quantity: Number(quantity) || 1 })
      setName('')
      setQuantity('1')
      load()
    } catch (err) {
      toast(errorText(err, t), 'error')
    }
  }

  const remove = async (item: EquipmentItem): Promise<void> => {
    if (!window.confirm(t('equipment.removeConfirm', { name: item.name }))) return
    try {
      await window.api.equipment.remove(item.id)
      setMarks((cur) => { const next = { ...cur }; delete next[item.id]; return next })
      load()
    } catch (err) {
      toast(errorText(err, t), 'error')
    }
  }

  const label = (i: EquipmentItem): string => (i.quantity > 1 ? `${i.name} (${i.quantity})` : i.name)
  const list = items ?? []
  const unanswered = list.filter((i) => marks[i.id]?.present == null)
  const missing = list.filter((i) => marks[i.id]?.present === false)

  const save = async (): Promise<void> => {
    if (!reg) return
    if (!list.length) return toast(t('equipment.needItems'), 'error')
    if (unanswered.length) return toast(t('equipment.needAll', { n: unanswered.length }), 'error')
    if (missing.some((i) => !marks[i.id]?.note.trim())) return toast(t('equipment.needNote'), 'error')
    setBusy(true)
    try {
      const r = await window.api.registers.add(reg.id, {
        items: list.map((i) => `${marks[i.id]?.present ? '✓' : '✗'} ${label(i)}`).join('\n'),
        missing: missing.map((i) => `${label(i)}: ${marks[i.id].note.trim()}`).join('\n'),
        missing_count: String(missing.length),
        notes: notes.trim()
      })
      toast(t('registers.recorded', { n: r.number }))
      onSaved?.(r.number)
    } catch (err) {
      toast(errorText(err, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="equipment">
      <div className="section-head">
        {/* in a handover the step's own title already names the register */}
        {checking ? <span /> : <h2>{t('equipment.title')}</h2>}
        {checking && list.length > 0 && (
          <button type="button" onClick={() => list.forEach((i) => mark(i.id, { present: true }))}><Icon name="clipboard" /> {t('equipment.allPresent')}</button>
        )}
      </div>
      <p className="hint">{checking ? t('equipment.checkIntro') : t('equipment.intro')}</p>
      {items && !list.length && <p className="empty">{t('equipment.empty')}</p>}
      <ul className="equipment-list">
        {list.map((i) => {
          const m = marks[i.id]
          return (
            <li key={i.id} className={m?.present === false ? 'missing' : m?.present ? 'present' : ''}>
              <span className="equipment-name" dir="auto">{label(i)}</span>
              {checking && (
                <span className="seg equipment-mark">
                  <button type="button" className={m?.present === true ? 'seg-btn on' : 'seg-btn'} onClick={() => mark(i.id, { present: true })}>✓ {t('equipment.present')}</button>
                  <button type="button" className={m?.present === false ? 'seg-btn on bad' : 'seg-btn'} onClick={() => mark(i.id, { present: false })}>✗ {t('equipment.missing')}</button>
                </span>
              )}
              <button type="button" className="link danger" onClick={() => remove(i)} title={t('equipment.remove')} aria-label={t('equipment.remove')}><Icon name="x" size={16} /></button>
              {checking && m?.present === false && (
                <input className="equipment-note" value={m.note} onChange={(e) => mark(i.id, { note: e.target.value })}
                  placeholder={t('equipment.notePlaceholder')} dir="auto" autoFocus />
              )}
            </li>
          )
        })}
      </ul>
      <form className="equipment-add" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('equipment.newName')} dir="auto" />
        <input value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="qty" aria-label={t('equipment.quantity')} title={t('equipment.quantity')} />
        <button type="submit" disabled={!name.trim()}><Icon name="enter" /> {t('equipment.add')}</button>
      </form>
      {checking && (
        <>
          <label>{t('equipment.notes')}<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} dir="auto" /></label>
          {missing.length > 0 && <div className="banner warn"><Icon name="alert" /> {t('equipment.missingCount', { n: missing.length })}</div>}
          <div className="actions">
            {children}
            <button type="button" className="primary big" disabled={busy} onClick={save}><Icon name="book" /> {t('registers.record')}</button>
          </div>
        </>
      )}
    </div>
  )
}
