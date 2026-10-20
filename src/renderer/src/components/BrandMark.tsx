import type { ReactNode } from 'react'
import Icon from './Icon'
import { BRAND } from '../brand'

/** The organisation logos when the build has them (the faculty's, then the university's), otherwise the shield. */
export default function BrandMark({ big = false }: { big?: boolean }): ReactNode {
  if (BRAND.logo) {
    const mark = (src: string): ReactNode => <span className={`brand-mark logo${big ? ' big' : ''}`}><img src={src} alt="" /></span>
    if (!BRAND.logo2) return mark(BRAND.logo)
    return <span className="brand-marks">{mark(BRAND.logo)}{mark(BRAND.logo2)}</span>
  }
  return <span className={`brand-mark${big ? ' big' : ''}`}><Icon name="shield" size={big ? 30 : 22} /></span>
}
