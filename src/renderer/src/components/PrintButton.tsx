import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Lang } from '@shared/types'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import Icon from './Icon'
import { errorText } from '../util'

/** "Print / PDF": builds an A4 PDF with the faculty header, asks where to save it, and says where it went. */
export default function PrintButton({ run, disabled = false }: { run(lang: Lang): Promise<string | null>; disabled?: boolean }): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [busy, setBusy] = useState(false)
  const click = async (): Promise<void> => {
    setBusy(true)
    try {
      const path = await run(currentLang())
      if (path) toast(t('export.saved', { path }))
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" disabled={busy || disabled} onClick={click}>
      <Icon name="printer" size={18} /> {t('print.button')}
    </button>
  )
}
