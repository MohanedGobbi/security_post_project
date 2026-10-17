import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { savedCameraId } from '../util'

/**
 * Webcam that looks for a QR code twice a second and reports the first one found.
 * With `prefix`, other QR codes in view (products, posters…) are ignored.
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
    const base = { width: { ideal: 1280 }, height: { ideal: 720 } }
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
            const c = document.createElement('canvas')
            c.width = v.videoWidth
            c.height = v.videoHeight
            ;(c.getContext('2d') as CanvasRenderingContext2D).drawImage(v, 0, 0)
            const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.85))
            if (blob) {
              const codes = await window.api.scan.barcodes(new Uint8Array(await blob.arrayBuffer()))
              const code = prefix ? codes.find((c) => c.startsWith(prefix)) : codes[0]
              if (code && !stopped) onCodeRef.current(code)
            }
          } finally {
            busy.current = false
          }
        }, 500)
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
      <div className="photo-cam"><video ref={videoRef} muted playsInline /></div>
      <p className="hint"><span className="spinner dark" /> {t('patrol.scanning')} {hint}</p>
      <button type="button" onClick={onClose}>{t('common.close')}</button>
    </div>
  )
}
