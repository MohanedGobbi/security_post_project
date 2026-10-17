import type { ReactNode } from 'react'
import Icon from './Icon'
import { BRAND } from '../brand'

/** The organisation logo when the build has one, otherwise the shield. */
export default function BrandMark({ big = false }: { big?: boolean }): ReactNode {
  if (BRAND.logo) {
    return <span className={`brand-mark logo${big ? ' big' : ''}`}><img src={BRAND.logo} alt="" /></span>
  }
  return <span className={`brand-mark${big ? ' big' : ''}`}><Icon name="shield" size={big ? 30 : 22} /></span>
}
