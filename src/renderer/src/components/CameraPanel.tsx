import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ScanResult } from '@shared/types'
import Icon from './Icon'
import { savedCameraId } from '../util'
import { isDone, looksLikeCardText, scanFrame, snapshot, type Region } from '../scanPipeline'

const CARD_RATIO = 85.6 / 53.98 // ID-1 card format
const GUIDE_WIDTH = 0.82 // share of the video width covered by the guide frame
/** set by the web demo (demo/app/main.ts): offers a sample card when there is no webcam */
const DEMO = (window as { __SECREG_DEMO__?: boolean }).__SECREG_DEMO__ === true

type Busy = null | 'scan' | 'text' | 'ai'

/** manual reading tries every version of the frame; the live camera tries a few and then looks at a new frame */
const MANUAL_VARIANTS = 9
const AUTO_VARIANTS = 3
/** pause between two automatic attempts, and how many failed attempts before the guard is advised what to do */
const AUTO_EVERY_MS = 400
const AUTO_TROUBLE_AFTER = 6

/** width of the picture sent to the printed-text reader: Arabic letters are small, downscaling them costs accuracy */
const FRONT_WIDTH = 2400

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const analyze = (image: Uint8Array, opts: { barcodes?: boolean; text?: boolean }): Promise<ScanResult> => window.api.scan.analyze(image, opts)

interface Props {
  onScan(result: ScanResult): void
  /** a picture of the card that was just scanned: it is saved with the entry */
  onCard(jpeg: Uint8Array): void
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

export default function CameraPanel({ onScan, onCard, onPhoto, onTextLines, onError, hasPhoto, scan, photo }: Props): ReactNode {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const [noCamera, setNoCamera] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  /** automatic reading from the live camera: on until a card has been read (the page is left for each new visitor) */
  const [auto, setAuto] = useState(true)
  const [found, setFound] = useState(false)
  const [autoState, setAutoState] = useState<'idle' | 'reading' | 'trouble'>('idle')
  const busyRef = useRef<Busy>(null)
  busyRef.current = busy

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

  /** the demo has no reader: it answers a sample card whatever the image */
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

  /** Manual reading of one source (a camera frame or a photo): all the versions of it, until a document validates. */
  const scanSource = async (src: CanvasImageSource, region: Region): Promise<void> => {
    setBusy('scan')
    setProgress([0, MANUAL_VARIANTS])
    try {
      // the picture is taken first: the camera moves on while the reading goes on
      const picture = await snapshot(src, region)
      // the printed text first (0.3 s): the front of an ID card has no machine-readable zone, and trying one costs seconds
      const front = await window.api.scan.readFront(await snapshot(src, region, FRONT_WIDTH)).catch(() => null)
      let r: ScanResult
      if (front && (front.complete || isDone(front))) {
        r = front
      } else {
        r = await scanFrame(src, region, analyze, { variants: MANUAL_VARIANTS, onProgress: (d, n) => setProgress([d, n]) })
        // no valid machine-readable zone either: what the printed text gave still helps (the guard checks it)
        if (!isDone(r) && front) {
          if (front.source === 'ocr') {
            r = r.source === 'none' ? { ...front, barcodes: r.barcodes } : { ...r, fields: { ...r.fields, ...front.fields }, lines: front.lines }
          } else if (r.source === 'none') {
            r = { ...r, lines: front.lines }
          }
        }
      }
      onCard(picture)
      onScan(r)
      if (isDone(r) || r.complete) setFound(true)
    } catch (e) {
      onError(String(e))
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  const fromCamera = async (kind: Exclude<Busy, null>): Promise<void> => {
    const v = videoRef.current
    if (!v || !ready) return
    if (kind === 'scan') return scanSource(v, guideRegion(v))
    run(kind, await prepareForOcr(v, ...guideRegion(v)))
  }

  const lastImport = useRef<ImageBitmap | null>(null)
  const importFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    const bmp = await createImageBitmap(file)
    lastImport.current = bmp
    // a photo of a card: the whole picture is the region, the machine-readable zone is in its lower part
    scanSource(bmp, [0, 0, bmp.width, bmp.height])
  }

  // Automatic reading: while the camera is on and no card has been read yet, look at the guide all the time,
  // and read it as soon as printed text is in it. Nothing to press, no exact alignment needed.
  useEffect(() => {
    if (!scan || !ready || !auto || found) { setAutoState('idle'); return }
    const signal = { cancelled: false }
    let failures = 0
    const loop = async (): Promise<void> => {
      while (!signal.cancelled) {
        await sleep(AUTO_EVERY_MS)
        const v = videoRef.current
        if (signal.cancelled || !v || busyRef.current || v.videoWidth === 0) continue
        const region = guideRegion(v)
        if (!looksLikeCardText(v, region)) { failures = 0; setAutoState('idle'); continue }
        setAutoState(failures >= AUTO_TROUBLE_AFTER ? 'trouble' : 'reading')
        try {
          // the picture of the frame being read, kept only if the reading succeeds
          const picture = await snapshot(v, region)
          // the front of an ID card has no machine-readable zone: its printed text is tried on the first look and again later
          if (failures % 3 === 0) {
            const front = await window.api.scan.readFront(await snapshot(v, region, FRONT_WIDTH)).catch(() => null)
            if (signal.cancelled) return
            if (front && (front.complete || isDone(front))) {
              setFound(true)
              setAutoState('idle')
              onCard(picture)
              onScan(front)
              return
            }
          }
          const r = await scanFrame(v, region, analyze, { variants: AUTO_VARIANTS, signal })
          if (signal.cancelled) return
          if (isDone(r)) {
            setFound(true)
            setAutoState('idle')
            onCard(picture)
            onScan(r)
            return
          }
          failures++
        } catch {
          failures++
        }
      }
    }
    loop()
    return () => { signal.cancelled = true }
    // onScan is a new closure on every render of the page: the loop must not restart because of it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan, ready, auto, found])

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
        {busy && (
          <div className="camera-busy">
            <span className="spinner" />{t(busy === 'scan' ? 'visitor.scanning' : 'visitor.readingText')}
            {busy === 'scan' && progress && progress[0] > 0 && <small> {progress[0]}/{progress[1]}</small>}
          </div>
        )}
        {!busy && scan && auto && !noCamera && (
          <div className={`auto-badge ${found ? 'done' : autoState}`} role="status">
            {found ? t('visitor.autoDone') : autoState === 'reading' ? t('visitor.autoReading') : autoState === 'trouble' ? t('visitor.autoTrouble') : t('visitor.autoWatching')}
          </div>
        )}
      </div>
      {scan && <p className="hint">{t('visitor.scanHelp')}</p>}
      {scan && !noCamera && (
        <label className="check auto-toggle">
          <input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); setFound(false) }} /> {t('visitor.autoScan')}
        </label>
      )}
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
