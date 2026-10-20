import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { bytesToUrl } from '../util'
import Icon from './Icon'

/** Object URLs of some JPEG pictures, released when they change or the component goes away */
function useUrls(cards: Uint8Array[]): string[] {
  const urls = useMemo(() => cards.map((c) => bytesToUrl(c)).filter((u): u is string => !!u), [cards])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  return urls
}

function Lightbox({ url, onClose }: { url: string; onClose(): void }): ReactNode {
  const { t } = useTranslation()
  return (
    <div className="lightbox" role="dialog" aria-label={t('card.title')} onClick={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <img src={url} alt="" />
    </div>
  )
}

/** Pictures of the card scanned for the entry being recorded: what was scanned stays visible, and can be removed */
export function CardPictures({ cards, onRemove }: { cards: Uint8Array[]; onRemove(index: number): void }): ReactNode {
  const { t } = useTranslation()
  const urls = useUrls(cards)
  const [open, setOpen] = useState<string | null>(null)
  if (urls.length === 0) return null
  return (
    <div className="card-pictures">
      <p className="hint">{t('card.savedWithEntry')}</p>
      <ul>
        {urls.map((u, i) => (
          <li key={u}>
            <button type="button" className="thumb" onClick={() => setOpen(u)} aria-label={t('card.enlarge')}>
              <img src={u} alt={t('card.title')} />
            </button>
            <button type="button" className="icon-btn thumb-remove" onClick={() => onRemove(i)} aria-label={t('card.remove')} title={t('card.remove')}>
              <Icon name="x" size={14} />
            </button>
          </li>
        ))}
      </ul>
      {open && <Lightbox url={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** The saved pictures of a record, read only */
export function CardGallery({ cards }: { cards: Uint8Array[] }): ReactNode {
  const { t } = useTranslation()
  const urls = useUrls(cards)
  const [open, setOpen] = useState<string | null>(null)
  if (urls.length === 0) return null
  return (
    <section className="card-gallery">
      <h3>{t('card.title')}</h3>
      <ul>
        {urls.map((u) => (
          <li key={u}>
            <button type="button" className="thumb big" onClick={() => setOpen(u)} aria-label={t('card.enlarge')}>
              <img src={u} alt={t('card.title')} />
            </button>
          </li>
        ))}
      </ul>
      {open && <Lightbox url={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
