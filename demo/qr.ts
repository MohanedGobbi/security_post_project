// QR codes in the browser (the desktop app does this in its main process).
// The WebAssembly files are bundled with the demo, so it works without any CDN.
import { prepareZXingModule as prepareReader, readBarcodes } from 'zxing-wasm/reader'
import { prepareZXingModule as prepareWriter, writeBarcode } from 'zxing-wasm/writer'
import readerWasm from 'zxing-wasm/reader/zxing_reader.wasm?url'
import writerWasm from 'zxing-wasm/writer/zxing_writer.wasm?url'

let ready = false
function init(): void {
  if (ready) return
  prepareReader({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? readerWasm : prefix + path) } })
  prepareWriter({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? writerWasm : prefix + path) } })
  ready = true
}

export async function readQr(image: Uint8Array): Promise<string[]> {
  init()
  try {
    const results = await readBarcodes(new Blob([image as BlobPart], { type: 'image/jpeg' }), { tryHarder: true, maxNumberOfSymbols: 4 })
    return results.filter((r) => r.isValid && r.text).map((r) => r.text)
  } catch {
    return []
  }
}

/** Scalable SVG markup */
export async function qrSvg(text: string): Promise<string> {
  init()
  const { svg } = await writeBarcode(text, { format: 'QRCode', scale: 8, ecLevel: 'M' })
  return svg.replace(/<\?xml[^>]*>\s*/, '').replace(/<!DOCTYPE[^>]*>\s*/, '').replace(/<svg width="(\d+)" height="(\d+)"/, '<svg viewBox="0 0 $1 $2"')
}

export async function qrDataUrl(text: string): Promise<string> {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await qrSvg(text))}`
}
