import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'

/**
 * QR codes and barcodes seen by the webcam: the digital student card, and the program's own codes (patrol checkpoints, passes).
 * ID cards are not read: the guard photographs them and types the details.
 */

let zxingReady = false
function ensureZxing(): void {
  if (zxingReady) return
  // Load the wasm from disk instead of the default CDN so scanning works offline
  const wasm = readFileSync(join(app.getAppPath(), 'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'))
  prepareZXingModule({ overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer } })
  zxingReady = true
}

/** The texts of the codes in a picture (JPEG or PNG bytes); none when the picture holds no readable code. */
export async function barcodeTexts(image: Uint8Array): Promise<string[]> {
  try {
    ensureZxing()
    const results = await readBarcodes(image, { tryHarder: true, tryRotate: true, tryInvert: true, maxNumberOfSymbols: 4 })
    return results.filter((r) => r.isValid && r.text).map((r) => r.text)
  } catch {
    return []
  }
}
