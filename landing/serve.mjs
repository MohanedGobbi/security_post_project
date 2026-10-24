// Serves the built landing page (dist/) on http://localhost:4173 with no network and no dependencies, then opens it.
// The page and the embedded demo use ES modules, which browsers refuse to load from file://, hence this server.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { exec } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const port = Number(process.env.PORT) || 4173
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.wasm': 'application/wasm', '.ico': 'image/x-icon', '.traineddata': 'application/octet-stream'
}

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
  if (path.endsWith('/')) path += 'index.html'
  const file = normalize(join(root, path))
  if (!file.startsWith(root + sep) && file !== root) { res.writeHead(403).end(); return }
  try {
    if ((await stat(file)).isDirectory()) { res.writeHead(302, { location: path + '/' }).end(); return }
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
    res.end(await readFile(file))
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found')
  }
}).listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}/`
  console.log(`Landing page: ${url}  (Ctrl+C to stop)`)
  const open = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`
  if (!process.env.NO_OPEN) exec(open)
})
