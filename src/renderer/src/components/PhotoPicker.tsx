import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from './Icon'
import { savedCameraId } from '../util'

const MAX_SIDE = 1280

async function toJpeg(src: CanvasImageSource, w: number, h: number): Promise<Uint8Array> {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * scale)
  c.height = Math.round(h * scale)
  ;(c.getContext('2d') as CanvasRenderingContext2D).drawImage(src, 0, 0, c.width, c.height)
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.85))
  return new Uint8Array(await blob.arrayBuffer())
}

/** Thumbnails of JPEG bytes, with object URLs released automatically. */
export function useImageUrls(images: Uint8Array[]): string[] {
  const urls = useMemo(() => images.map((b) => URL.createObjectURL(new Blob([b as BlobPart], { type: 'image/jpeg' }))), [images])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  return urls
}

/** Small webcam preview + import button, for evidence photos (vehicles, parcels, incidents). */
export default function PhotoPicker({ photos, onChange, max }: { photos: Uint8Array[]; onChange(p: Uint8Array[]): void; max: number }): ReactNode {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const [noCamera, setNoCamera] = useState(false)
  const urls = useImageUrls(photos)
  const full = photos.length >= max

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    const id = savedCameraId()
    const base = { width: { ideal: 1280 }, height: { ideal: 720 } }
    navigator.mediaDevices.getUserMedia({ video: id ? { ...base, deviceId: { exact: id } } : base })
      .catch(() => navigator.mediaDevices.getUserMedia({ video: base }))
      .then(async (s) => {
        if (cancelled) return s.getTracks().forEach((tr) => tr.stop())
        stream = s
        const v = videoRef.current
        if (v) {
          v.srcObject = s
          await v.play().catch(() => undefined)
          setReady(true)
        }
      })
      .catch(() => !cancelled && setNoCamera(true))
    return () => {
      cancelled = true
      stream?.getTracks().forEach((tr) => tr.stop())
    }
  }, [])

  const take = async (): Promise<void> => {
    const v = videoRef.current
    if (!v || !ready || full) return
    onChange([...photos, await toJpeg(v, v.videoWidth, v.videoHeight)])
  }

  const importFiles = async (files: FileList | null): Promise<void> => {
    if (!files) return
    const added: Uint8Array[] = []
    for (const f of [...files].slice(0, max - photos.length)) {
      const bmp = await createImageBitmap(f)
      added.push(await toJpeg(bmp, bmp.width, bmp.height))
    }
    onChange([...photos, ...added])
  }

  return (
    <div className="photo-picker">
      <div className="photo-cam">
        {noCamera ? <p className="hint">{t('photo.noCamera')}</p> : <video ref={videoRef} muted playsInline />}
      </div>
      <div className="photo-actions">
        <button type="button" onClick={take} disabled={!ready || full}><Icon name="camera" /> {t('photo.take')}</button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={full}><Icon name="upload" /> {t('photo.import')}</button>
        {max > 1 && <span className="hint">{t('photo.max', { count: max })}</span>}
        <input ref={fileRef} type="file" accept="image/*" multiple={max > 1} hidden onChange={(e) => { importFiles(e.target.files); e.target.value = '' }} />
      </div>
      {urls.length > 0 && (
        <div className="thumbs">
          {urls.map((u, i) => (
            <div key={u} className="thumb">
              <img src={u} alt="" />
              <button type="button" aria-label={t('common.removePhoto')} onClick={() => onChange(photos.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
