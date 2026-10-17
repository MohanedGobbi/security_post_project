import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { KeyItem, KeyKind, KeyLoan } from '@shared/types'
import { formatDateTime, formatDuration } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import PromptDialog from '../components/PromptDialog'
import { errorText, todayStr } from '../util'

const KINDS: KeyKind[] = ['key', 'badge', 'radio', 'equipment', 'other']

function LendDialog({ item, onClose, onDone }: { item: KeyItem; onClose(): void; onDone(): void }): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [f, setF] = useState({ borrower: '', borrowerInfo: '', dueAt: '', notes: '' })
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    try {
      await window.api.keys.lend(item.id, { ...f, dueAt: f.dueAt ? new Date(f.dueAt).toISOString() : null })
      toast(t('keys.lent', { item: item.label, name: f.borrower }))
      onDone()
    } catch (err) {
      toast(errorText(err, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <form className="card modal-card" onSubmit={submit}>
        <h2>{t('keys.lendTitle', { item: item.label })}</h2>
        <label className="req">{t('keys.borrower')}<input value={f.borrower} onChange={(e) => setF({ ...f, borrower: e.target.value })} dir="auto" autoFocus /></label>
        <div className="row2">
          <label>{t('keys.borrowerInfo')}<input value={f.borrowerInfo} onChange={(e) => setF({ ...f, borrowerInfo: e.target.value })} dir="auto" /></label>
          <label>{t('keys.dueAt')}<input type="datetime-local" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} /></label>
        </div>
        <label>{t('visitor.notes')}<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} dir="auto" /></label>
        <div className="actions">
          <button type="button" onClick={onClose}>{t('common.cancel')}</button>
          <button className="primary" disabled={busy || !f.borrower.trim()}>{t('keys.lend')}</button>
        </div>
      </form>
    </div>
  )
}

function ItemAdmin({ onChanged }: { onChanged(): void }): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [f, setF] = useState({ label: '', kind: 'key' as KeyKind, code: '', location: '' })
  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    try {
      await window.api.keys.addItem(f)
      setF({ label: '', kind: f.kind, code: '', location: '' })
      onChanged()
    } catch (err) {
      toast(errorText(err, t), 'error')
    }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>{t('keys.addItem')}</h2>
      <div className="row2">
        <label className="req">{t('keys.item')}<input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} dir="auto" /></label>
        <label>{t('keys.kind')}
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as KeyKind })}>
            {KINDS.map((k) => <option key={k} value={k}>{t(`keys.kinds.${k}`)}</option>)}
          </select>
        </label>
      </div>
      <div className="row2">
        <label>{t('keys.code')}<input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} dir="ltr" /></label>
        <label>{t('keys.location')}<input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} dir="auto" /></label>
      </div>
      <div className="actions"><button className="primary" disabled={!f.label.trim()}>{t('keys.addItem')}</button></div>
    </form>
  )
}

export default function KeysPage(): ReactNode {
  const { t } = useTranslation()
  const { toast, user } = useApp()
  const isAdmin = user.role === 'admin'
  const [items, setItems] = useState<KeyItem[]>([])
  const [history, setHistory] = useState<KeyLoan[]>([])
  const [q, setQ] = useState('')
  const [lending, setLending] = useState<KeyItem | null>(null)
  const [returning, setReturning] = useState<KeyItem | null>(null)
  const lang = currentLang()

  const load = useCallback(() => {
    window.api.keys.items(isAdmin).then(setItems)
    window.api.keys.loans({ from: todayStr(new Date(Date.now() - 6 * 86400000)), to: todayStr(), text: '' }).then(setHistory)
  }, [isAdmin])
  useEffect(load, [load])

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase()
    return items.filter((i) => !n || `${i.label} ${i.code} ${i.location} ${i.loan?.borrower ?? ''}`.toLowerCase().includes(n))
  }, [items, q])

  const outCount = items.filter((i) => i.loan).length
  const isOverdue = (l: KeyLoan | null): boolean => !!l?.dueAt && new Date(l.dueAt).getTime() < Date.now()

  const toggle = async (i: KeyItem): Promise<void> => {
    try {
      await window.api.keys.setActive(i.id, !i.active)
      load()
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  return (
    <div className="page-card wide">
      <section className="card">
        <div className="section-head">
          <h1>{t('keys.title')}</h1>
          <span className="count-pill">{t('keys.outCount', { count: outCount })}</span>
        </div>
        <input className="search-big" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('keys.filter')} dir="auto" />
        {items.length === 0 ? <p className="empty">{t('keys.none')}</p> : (
          <div className="key-grid">
            {filtered.map((i) => (
              <div key={i.id} className={`key-card ${i.loan ? (isOverdue(i.loan) ? 'overdue' : 'out') : 'free'} ${i.active ? '' : 'disabled'}`}>
                <div className="key-top">
                  <strong dir="auto">{i.label}</strong>
                  <span className="tag">{t(`keys.kinds.${i.kind}`)}</span>
                </div>
                <span className="muted">{[i.code, i.location].filter(Boolean).join(' · ')}</span>
                {i.loan ? (
                  <div className="key-loan">
                    <span><b dir="auto">{i.loan.borrower}</b>{i.loan.borrowerInfo && <span className="muted"> · {i.loan.borrowerInfo}</span>}</span>
                    <span className="muted">{formatDateTime(i.loan.outAt, lang)} ({formatDuration(i.loan.outAt, null, lang)})</span>
                    {i.loan.dueAt && <span className={isOverdue(i.loan) ? 'overdue-text' : 'muted'}>{isOverdue(i.loan) ? t('keys.overdue') : t('keys.dueAt')}: {formatDateTime(i.loan.dueAt, lang)}</span>}
                    <button type="button" className="exit-btn" onClick={() => setReturning(i)}>{t('keys.giveBack')}</button>
                  </div>
                ) : (
                  <div className="key-loan">
                    <span className="free-text">{t('keys.available')}</span>
                    {i.active && <button type="button" className="primary" onClick={() => setLending(i)}>{t('keys.lend')}</button>}
                  </div>
                )}
                {isAdmin && !i.loan && (
                  <button type="button" className="link" onClick={() => toggle(i)}>{t(i.active ? 'keys.disable' : 'keys.enable')}</button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>{t('log.tab.keys')}</h2>
        {history.length === 0 ? <p className="empty">–</p> : (
          <div className="table-wrap">
            <table className="log-table static">
              <thead><tr><th>{t('keys.item')}</th><th>{t('keys.borrower')}</th><th>{t('keys.outAt')}</th><th>{t('keys.dueAt')}</th><th>{t('keys.returnedAt')}</th><th>{t('visitor.guardIn')}</th></tr></thead>
              <tbody>
                {history.map((l) => (
                  <tr key={l.id}>
                    <td><strong dir="auto">{l.itemLabel}</strong></td>
                    <td dir="auto">{l.borrower}{l.borrowerInfo && <div className="muted">{l.borrowerInfo}</div>}</td>
                    <td>{formatDateTime(l.outAt, lang)}</td>
                    <td>{l.dueAt ? formatDateTime(l.dueAt, lang) : ''}</td>
                    <td>{l.returnedAt ? formatDateTime(l.returnedAt, lang) : <span className={`tag ${isOverdue(l) ? 'sev-high' : 'waiting'}`}>{t(isOverdue(l) ? 'keys.overdue' : 'keys.out')}</span>}</td>
                    <td>{l.guardOut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isAdmin && <ItemAdmin onChanged={load} />}
      {lending && <LendDialog item={lending} onClose={() => setLending(null)} onDone={() => { setLending(null); load() }} />}
      {returning?.loan && (
        <PromptDialog
          title={t('keys.returnTitle', { item: returning.label })}
          summary={<><strong dir="auto">{returning.loan.borrower}</strong><span className="muted">{formatDateTime(returning.loan.outAt, lang)}</span></>}
          label={t('keys.returnNote')}
          confirmLabel={t('keys.giveBack')}
          onClose={() => setReturning(null)}
          onConfirm={async (note) => {
            await window.api.keys.giveBack(returning.loan!.id, note)
            toast(t('keys.returned', { item: returning.label }))
            setReturning(null)
            load()
          }}
        />
      )}
    </div>
  )
}
