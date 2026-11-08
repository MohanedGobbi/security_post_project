import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ATTENDANCE_STATUSES, type AttendanceMonthRow, type AttendanceRow, type AttendanceStatus } from '@shared/types'
import { can } from '@shared/permissions'
import { useApp } from '../App'
import Icon from '../components/Icon'
import PrintButton from '../components/PrintButton'
import { errorText, todayStr } from '../util'

/**
 * Attendance of the security team. The security chief marks every member by hand for the day (present, late, absent, leave, sick,
 * mission); the dean only reads. Below: the month's totals, and the list of members.
 */
export default function AttendancePage(): ReactNode {
  const { t } = useTranslation()
  const { toast, user } = useApp()
  const canMark = can(user, 'attendance')
  const [date, setDate] = useState(todayStr())
  const [month, setMonth] = useState(todayStr().slice(0, 7))
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [months, setMonths] = useState<AttendanceMonthRow[]>([])
  const [form, setForm] = useState({ name: '', jobTitle: '', startTime: '' })

  const fail = useCallback((e: unknown) => toast(errorText(e, t), 'error'), [toast, t])
  const loadDay = useCallback(() => { window.api.attendance.day(date).then(setRows).catch(fail) }, [date, fail])
  const loadMonth = useCallback(() => { window.api.attendance.month(month).then(setMonths).catch(fail) }, [month, fail])
  useEffect(loadDay, [loadDay])
  useEffect(loadMonth, [loadMonth])

  const mark = async (r: AttendanceRow, patch: { status?: AttendanceStatus; arrivedAt?: string; note?: string }): Promise<void> => {
    try {
      await window.api.attendance.mark({
        staffId: r.staff.id, date,
        status: patch.status ?? r.mark?.status ?? 'present',
        arrivedAt: patch.arrivedAt ?? r.mark?.arrivedAt ?? '',
        note: patch.note ?? r.mark?.note ?? ''
      })
      loadDay()
      loadMonth()
    } catch (e) { fail(e) }
  }

  const markAll = async (): Promise<void> => {
    try {
      const n = await window.api.attendance.markAllPresent(date)
      toast(t('attendance.markedN', { n }))
      loadDay()
      loadMonth()
    } catch (e) { fail(e) }
  }

  const addMember = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    try {
      await window.api.attendance.saveStaff({ name: form.name, jobTitle: form.jobTitle, startTime: form.startTime })
      setForm({ name: '', jobTitle: '', startTime: '' })
      loadDay()
      loadMonth()
    } catch (err) { fail(err) }
  }

  const remove = async (r: AttendanceRow): Promise<void> => {
    if (!window.confirm(t('attendance.removeConfirm', { name: r.staff.name }))) return
    try {
      await window.api.attendance.removeStaff(r.staff.id)
      loadDay()
      loadMonth()
    } catch (e) { fail(e) }
  }

  const unmarked = rows.filter((r) => !r.mark).length
  return (
    <div className="stack attendance-page">
      <section className="card">
        <h1>{t('attendance.title')}</h1>
        <p className="hint">{t(canMark ? 'attendance.help' : 'attendance.helpRead')}</p>
        <div className="actions start">
          <label>{t('attendance.day')} <input type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
          <button type="button" onClick={() => setDate(todayStr())}>{t('attendance.today')}</button>
          {canMark && <button type="button" className="primary" disabled={unmarked === 0} onClick={markAll}>{t('attendance.markAllPresent')}</button>}
          <PrintButton run={(lang) => window.api.attendance.dayPdf(date, lang)} disabled={rows.length === 0} />
        </div>
        {rows.length === 0 ? <p className="empty">{t('attendance.noStaff')}</p> : (
          <div className="table-wrap">
            <table className="log-table att-table">
              <thead><tr><th>{t('attendance.name')}</th><th>{t('attendance.status')}</th><th>{t('attendance.arrived')}</th><th>{t('attendance.note')}</th><th>{t('attendance.markedBy')}</th>{canMark && <th />}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.staff.id}>
                    <td><strong>{r.staff.name}</strong>{r.staff.jobTitle && <small className="muted"> · {r.staff.jobTitle}</small>}{r.staff.startTime && <small className="muted"> · {r.staff.startTime}</small>}</td>
                    <td>
                      {canMark ? (
                        <div className="att-statuses" role="group">
                          {ATTENDANCE_STATUSES.map((s) => (
                            <button key={s} type="button" className={`seg-btn att-${s} ${r.mark?.status === s ? 'on' : ''}`} onClick={() => mark(r, { status: s })}>{t(`attendance.s.${s}`)}</button>
                          ))}
                        </div>
                      ) : r.mark ? <span className={`att-badge att-${r.mark.status}`}>{t(`attendance.s.${r.mark.status}`)}</span> : <span className="muted">{t('attendance.notMarked')}</span>}
                    </td>
                    <td>
                      {canMark && r.mark && (r.mark.status === 'present' || r.mark.status === 'late')
                        ? <input type="time" value={r.mark.arrivedAt} onChange={(e) => mark(r, { arrivedAt: e.target.value })} />
                        : r.mark?.arrivedAt ?? ''}
                    </td>
                    <td>
                      {canMark && r.mark
                        ? <input type="text" defaultValue={r.mark.note} maxLength={300} placeholder={t('attendance.note')} onBlur={(e) => e.target.value !== r.mark?.note && mark(r, { note: e.target.value })} />
                        : r.mark?.note ?? ''}
                    </td>
                    <td><small className="muted">{r.mark?.markedBy ?? ''}</small></td>
                    {canMark && <td><button type="button" className="link danger" title={t('attendance.remove')} onClick={() => remove(r)}>✕</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canMark && (
        <section className="card">
          <h2>{t('attendance.addMember')}</h2>
          <form className="actions start att-add" onSubmit={addMember}>
            <label>{t('attendance.name')} <input value={form.name} maxLength={120} required onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>{t('attendance.jobTitle')} <input value={form.jobTitle} maxLength={120} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></label>
            <label>{t('attendance.startTime')} <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></label>
            <button type="submit" className="primary">{t('attendance.add')}</button>
          </form>
          <p className="hint">{t('attendance.startTimeHelp')}</p>
        </section>
      )}

      <section className="card">
        <h2>{t('attendance.monthTitle')}</h2>
        <div className="actions start">
          <label>{t('attendance.month')} <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
          <PrintButton run={(lang) => window.api.attendance.monthPdf(month, lang)} disabled={months.length === 0} />
        </div>
        {months.length > 0 && (
          <div className="table-wrap">
            <table className="log-table">
              <thead><tr><th>{t('attendance.name')}</th>{ATTENDANCE_STATUSES.map((s) => <th key={s}>{t(`attendance.s.${s}`)}</th>)}</tr></thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.staff.id}><td><strong>{m.staff.name}</strong></td>{ATTENDANCE_STATUSES.map((s) => <td key={s} className={m.counts[s] ? '' : 'muted'}>{m.counts[s]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
