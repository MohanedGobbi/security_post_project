import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from './Icon'
import { savedCameraId } from '../util'

const CARD_RATIO = 85.6 / 53.98 // ID-1 card format
const GUIDE_WIDTH = 0.82 // share of the video width covered by the guide frame
/** width of a card picture: enough to read every line of the card on screen or on paper, about 100-300 KB */
const CARD_WIDTH = 1600

type Region = [number, number, number, number]

/** A JPEG of a region of a source (camera frame or imported picture), at most `maxWidth` pixels wide. */
async function snapshot(src: CanvasImageSource, [sx, sy, sw, sh]: Region, maxWidth = CARD_WIDTH, quality = 0.85): Promise<Uint8Array> {
  const scale = Math.min(1, maxWidth / sw)
  const c = document.createElement('canvas')
  c.width = Math.round(sw * scale)
  c.height = Math.round(sh * scale)
  const ctx = c.getContext('2d') as CanvasRenderingContext2D
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height)
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', quality))
  return new Uint8Array(await blob.arrayBuffer())
}

interface Props {
  /** a picture of the visitor's ID card: it is saved with the entry */
  onCard(jpeg: Uint8Array): void
  onPhoto(jpeg: Uint8Array): void
  onError(message: string): void
  hasPhoto: boolean
  /** card photos switched on (Settings → Features) */
  card: boolean
  /** visitor photo switched on */
  photo: boolean
}

/** The webcam of the visitor form: a photo of the ID card (nothing is read from it) and, when switched on, a photo of the visitor. */
export default function CameraPanel({ onCard, onPhoto, onError, hasPhoto, card, photo }: Props): ReactNode {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const [noCamera, setNoCamera] = useState(false)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    const start = async (): Promise<void> => {
      const id = savedCameraId()
      const base = { width: { ideal: 1920 }, height: { ideal: 1080 } }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: id ? { ...base, deviceId: { exact: id } } : base })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: base })
        } catch {
          if (!cancelled) setNoCamera(true)
          return
        }
      }
      if (cancelled) return stream.getTracks().forEach((tr) => tr.stop())
      const v = videoRef.current
      if (v) {
        v.srcObject = stream
        await v.play().catch(() => undefined)
        setReady(true)
      }
    }
    start()
    return () => {
      cancelled = true
      stream?.getTracks().forEach((tr) => tr.stop())
    }
  }, [])

  /** The part of the frame inside the on-screen card guide. */
  const guideRegion = (v: HTMLVideoElement): Region => {
    let w = v.videoWidth * GUIDE_WIDTH
    let h = w / CARD_RATIO
    if (h > v.videoHeight * 0.95) { h = v.videoHeight * 0.95; w = h * CARD_RATIO }
    return [(v.videoWidth - w) / 2, (v.videoHeight - h) / 2, w, h]
  }

  const takeCard = async (): Promise<void> => {
    const v = videoRef.current
    if (!v || !ready) return
    try {
      onCard(await snapshot(v, guideRegion(v)))
      setFlash(true)
      setTimeout(() => setFlash(false), 250)
    } catch (e) {
      onError(String(e))
    }
  }

  const importFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    try {
      const bmp = await createImageBitmap(file)
      onCard(await snapshot(bmp, [0, 0, bmp.width, bmp.height]))
    } catch (e) {
      onError(String(e))
    }
  }

  const takePhoto = async (): Promise<void> => {
    const v = videoRef.current
    if (!v || !ready) return
    const side = Math.min(v.videoWidth, v.videoHeight)
    onPhoto(await snapshot(v, [(v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side], 480))
  }

  // Space bar = photo of the card, when no text field is focused
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      if (card && e.code === 'Space' && !['input', 'textarea', 'select', 'button'].includes(tag)) {
        e.preventDefault()
        takeCard()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="camera-panel">
      <div className={`camera-view ${flash ? 'flash' : ''}`}>
        {noCamera ? (
          <div className="camera-missing"><Icon name="camera" size={40} /><p>{t('visitor.noCamera')}</p></div>
        ) : (
          <>
            <video ref={videoRef} muted playsInline />
            {card && <div className="card-guide" style={{ width: `${GUIDE_WIDTH * 100}%`, aspectRatio: String(CARD_RATIO) }} />}
          </>
        )}
      </div>
      {card && <p className="hint">{t('visitor.cardPhotoHelp')}</p>}
      <div className="camera-actions">
        {card && (
          <button type="button" className="primary big" disabled={!ready} onClick={takeCard}>
            <Icon name="camera" /> {t('visitor.takeCardPhoto')} <kbd>Space</kbd>
          </button>
        )}
        {photo && (
          <button type="button" className={card ? '' : 'primary big'} disabled={!ready} onClick={takePhoto}>
            <Icon name="user" /> {t(hasPhoto ? 'visitor.retakePhoto' : 'visitor.takePhoto')}
          </button>
        )}
        {card && (
          <button type="button" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> {t('visitor.importImage')}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
    </div>
  )
}
