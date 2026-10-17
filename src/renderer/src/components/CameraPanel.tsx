import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ScanResult } from '@shared/types'
import Icon from './Icon'
import { savedCameraId } from '../util'

const CARD_RATIO = 85.6 / 53.98 // ID-1 card format
const GUIDE_WIDTH = 0.82 // share of the video width covered by the guide frame
/** set by the web demo (demo/app/main.ts): offers a sample card when there is no webcam */
const DEMO = (window as { __SECREG_DEMO__?: boolean }).__SECREG_DEMO__ === true

type Busy = null | 'scan' | 'text'

interface Props {
  onScan(result: ScanResult): void
  onPhoto(jpeg: Uint8Array): void
  onTextLines(lines: string[]): void
  onError(message: string): void
  hasPhoto: boolean
  /** card scanning switched on (Settings → Features) */
  scan: boolean
  /** visitor photo switched on */
  photo: boolean
}

/** Grayscale + contrast stretch: helps OCR with uneven desk lighting. */
function enhance(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const hist = new Uint32Array(256)
  for (let i = 0; i < d.length; i += 4) {
    const y = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
    d[i] = d[i + 1] = d[i + 2] = y
    hist[y | 0]++
  }
  const total = w * h
  let lo = 0, hi = 255, acc = 0
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.02) { lo = v; break } }
  acc = 0
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.02) { hi = v; break } }
  const range = Math.max(1, hi - lo)
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.min(255, Math.max(0, ((d[i] - lo) * 255) / range))
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
}

async function canvasToBytes(c: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', quality))
  return new Uint8Array(await blob.arrayBuffer())
}

/** Draws a region of a source onto a canvas scaled to `targetWidth`, enhanced for OCR. */
async function prepareForOcr(src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): Promise<Uint8Array> {
  const targetWidth = Math.min(2000, Math.max(1400, sw))
  const scale = targetWidth / sw
  const c = document.createElement('canvas')
  c.width = Math.round(sw * scale)
  c.height = Math.round(sh * scale)
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height)
  enhance(ctx, c.width, c.height)
  return canvasToBytes(c, 0.92)
}

export default function CameraPanel({ onScan, onPhoto, onTextLines, onError, hasPhoto, scan, photo }: Props): ReactNode {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const [noCamera, setNoCamera] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)

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
  const guideRegion = (v: HTMLVideoElement): [number, number, number, number] => {
    let w = v.videoWidth * GUIDE_WIDTH
    let h = w / CARD_RATIO
    if (h > v.videoHeight * 0.95) { h = v.videoHeight * 0.95; w = h * CARD_RATIO }
    return [(v.videoWidth - w) / 2, (v.videoHeight - h) / 2, w, h]
  }

  const run = async (kind: Exclude<Busy, null>, image: Uint8Array): Promise<void> => {
    setBusy(kind)
    try {
      if (kind === 'scan') onScan(await window.api.scan.analyze(image))
      else onTextLines(await window.api.scan.readText(image))
    } catch (e) {
      onError(String(e))
    } finally {
      setBusy(null)
    }
  }

  const fromCamera = async (kind: Exclude<Busy, null>): Promise<void> => {
    const v = videoRef.current
    if (!v || !ready) return
    run(kind, await prepareForOcr(v, ...guideRegion(v)))
  }

  const lastImport = useRef<ImageBitmap | null>(null)
  const importFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    const bmp = await createImageBitmap(file)
    lastImport.current = bmp
    run('scan', await prepareForOcr(bmp, 0, 0, bmp.width, bmp.height))
  }

  const readText = async (): Promise<void> => {
    // after an import, read the imported image; otherwise the live camera
    const bmp = lastImport.current
    if (bmp && (noCamera || !ready)) run('text', await prepareForOcr(bmp, 0, 0, bmp.width, bmp.height))
    else fromCamera('text')
  }

  const takePhoto = async (): Promise<void> => {
    const v = videoRef.current
    if (!v || !ready) return
    const side = Math.min(v.videoWidth, v.videoHeight)
    const c = document.createElement('canvas')
    c.width = c.height = 480
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, 480, 480)
    onPhoto(await canvasToBytes(c, 0.85))
  }

  // Space bar = scan, when no text field is focused
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      if (scan && e.code === 'Space' && !['input', 'textarea', 'select', 'button'].includes(tag) && !busy) {
        e.preventDefault()
        fromCamera('scan')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="camera-panel">
      <div className="camera-view">
        {noCamera ? (
          <div className="camera-missing"><Icon name="camera" size={40} /><p>{t('visitor.noCamera')}</p></div>
        ) : (
          <>
            <video ref={videoRef} muted playsInline />
            {scan && (
              <div className="card-guide" style={{ width: `${GUIDE_WIDTH * 100}%`, aspectRatio: String(CARD_RATIO) }}>
                <span className="mrz-zone" />
              </div>
            )}
          </>
        )}
        {busy && <div className="camera-busy"><span className="spinner" />{t(busy === 'scan' ? 'visitor.scanning' : 'visitor.readingText')}</div>}
      </div>
      {scan && <p className="hint">{t('visitor.scanHelp')}</p>}
      <div className="camera-actions">
        {scan && (
          <button type="button" className="primary big" disabled={!ready || !!busy} onClick={() => fromCamera('scan')}>
            <Icon name="scan" /> {t('visitor.scanCard')} <kbd>Space</kbd>
          </button>
        )}
        {scan && DEMO && !ready && (
          <button type="button" className="primary big" disabled={!!busy} onClick={() => run('scan', new Uint8Array(0))}>
            <Icon name="scan" /> {t('visitor.sampleCard')}
          </button>
        )}
        {photo && (
          <button type="button" className={scan ? '' : 'primary big'} disabled={!ready || !!busy} onClick={takePhoto}>
            <Icon name="camera" /> {t(hasPhoto ? 'visitor.retakePhoto' : 'visitor.takePhoto')}
          </button>
        )}
        {scan && (
          <>
            <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()}>
              <Icon name="upload" /> {t('visitor.importImage')}
            </button>
            <button type="button" disabled={(!ready && !lastImport.current) || !!busy} onClick={readText}>
              <Icon name="text" /> {t('visitor.readText')}
            </button>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
    </div>
  )
}
