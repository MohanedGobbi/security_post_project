import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Lang } from '@shared/types'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import Icon from './Icon'
import { errorText } from '../util'

/**
 * "Print / PDF" (an A4 PDF with the faculty header) and, where the data suits a spreadsheet, "Excel" (the same rows to work on
 * in Excel). Each asks where to save the file and says where it went.
 */
export default function PrintButton({ run, runXlsx, disabled = false }: {
  run(lang: Lang): Promise<string | null>
  runXlsx?(lang: Lang): Promise<string | null>
  disabled?: boolean
}): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [busy, setBusy] = useState(false)
  const click = (fn: (lang: Lang) => Promise<string | null>) => async (): Promise<void> => {
    setBusy(true)
    try {
      const path = await fn(currentLang())
      if (path) toast(t('export.saved', { path }))
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button type="button" disabled={busy || disabled} onClick={click(run)}>
        <Icon name="printer" size={18} /> {t('print.button')}
      </button>
      {runXlsx && (
        <button type="button" disabled={busy || disabled} onClick={click(runXlsx)}>
          <Icon name="list" size={18} /> {t('print.excel')}
        </button>
      )}
    </>
  )
}
