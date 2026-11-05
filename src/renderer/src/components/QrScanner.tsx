import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { savedCameraId } from '../util'

/** the parts of the frame tried in turn: the whole picture, then its centre enlarged (a QR on a phone screen is small) */
const VIEWS: { share: number; width: number }[] = [
  { share: 1, width: 1280 },
  { share: 0.6, width: 1400 },
  { share: 0.38, width: 1400 }
]

/** A short beep when a code is read, so the guard knows without looking at the screen. */
function beep(): void {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 1400
    g.gain.value = 0.08
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.12)
    o.onended = () => void ctx.close()
  } catch { /* no sound device */ }
}

async function jpegOf(v: HTMLVideoElement, share: number, width: number): Promise<Uint8Array | null> {
  const sw = v.videoWidth * share
  const sh = v.videoHeight * share
  const scale = width / sw
  const c = document.createElement('canvas')
  c.width = Math.round(sw * scale)
  c.height = Math.round(sh * scale)
  const ctx = c.getContext('2d') as CanvasRenderingContext2D
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, c.width, c.height)
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.9))
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null
}

/**
 * Webcam that looks for a QR code (or a barcode) a few times a second and reports the first one found.
 * Each look tries the whole frame and its centre enlarged, so a small code held up on a phone is read too.
 * With `prefix`, other codes in view (products, posters…) are ignored.
 */
export default function QrScanner({ onCode, onClose, hint, prefix }: { onCode(text: string): void; onClose(): void; hint: string; prefix?: string }): ReactNode {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const busy = useRef(false)
  // latest callback, so the camera is not restarted when the parent re-renders
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let stopped = false
    const id = savedCameraId()
    const base = { width: { ideal: 1920 }, height: { ideal: 1080 } }
    navigator.mediaDevices.getUserMedia({ video: id ? { ...base, deviceId: { exact: id } } : base })
      .catch(() => navigator.mediaDevices.getUserMedia({ video: base }))
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((tr) => tr.stop())
        stream = s
        const v = videoRef.current
        if (!v) return
        v.srcObject = s
        await v.play().catch(() => undefined)
        timer = setInterval(async () => {
          if (busy.current || !v.videoWidth) return
          busy.current = true
          try {
            for (const view of VIEWS) {
              const image = await jpegOf(v, view.share, view.width)
              if (!image || stopped) break
              const codes = await window.api.scan.barcodes(image)
              const code = prefix ? codes.find((c) => c.startsWith(prefix)) : codes[0]
              if (code) {
                if (!stopped) { beep(); onCodeRef.current(code) }
                break
              }
            }
          } finally {
            busy.current = false
          }
        }, 350)
      })
      .catch(() => undefined)
    return () => {
      stopped = true
      if (timer) clearInterval(timer)
      stream?.getTracks().forEach((tr) => tr.stop())
    }
  }, [])

  return (
    <div className="qr-scanner">
      <div className="photo-cam"><video ref={videoRef} muted playsInline /><span className="qr-target" /></div>
      <p className="hint"><span className="spinner dark" /> {t('patrol.scanning')} {hint}</p>
      <button type="button" onClick={onClose}>{t('common.close')}</button>
    </div>
  )
}
