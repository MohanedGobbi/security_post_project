// Security Register server: sync for the posts + web dashboard for supervisors.
//
//   node server/index.ts
//
// Environment:
//   SECREG_PORT        listening port (default 8787)
//   SECREG_HOST        listening address (default 0.0.0.0)
//   SECREG_DATA        data folder: database + encryption key (default ./server-data)
//   SECREG_TLS_CERT    \ PEM files: serve HTTPS directly. Without them, put the server behind a
//   SECREG_TLS_KEY     / reverse proxy with HTTPS (posts send visitor data and tokens).
import { createServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { applyRetention, openDb } from './db.ts'
import { initServerKey } from './crypto.ts'
import { useSecureCookies } from './auth.ts'
import { makeHandler } from './http.ts'
import { deviceRoutes } from './routes-device.ts'
import { dashboardRoutes, initSetupToken } from './routes-dashboard.ts'

const port = Number(process.env.SECREG_PORT ?? 8787)
const host = process.env.SECREG_HOST ?? '0.0.0.0'
const dataDir = resolve(process.env.SECREG_DATA ?? 'server-data')
const certFile = process.env.SECREG_TLS_CERT
const keyFile = process.env.SECREG_TLS_KEY

mkdirSync(dataDir, { recursive: true })
initServerKey(dataDir)
openDb(dataDir)
deviceRoutes()
dashboardRoutes()

const handler = makeHandler(resolve(import.meta.dirname, 'public'))
const tls = !!(certFile && keyFile)
useSecureCookies(tls)
const server = tls
  ? createHttpsServer({ cert: readFileSync(certFile as string), key: readFileSync(keyFile as string) }, handler)
  : createServer(handler)

server.listen(port, host, () => {
  console.log(`Security Register server on ${tls ? 'https' : 'http'}://${host}:${port}  (data: ${join(dataDir, 'server.db')})`)
  if (!tls) console.log('Warning: plain HTTP. Use HTTPS (SECREG_TLS_CERT / SECREG_TLS_KEY or a reverse proxy) outside a test network.')
  const token = initSetupToken()
  if (token) console.log(`First start: open the dashboard and use this setup code to create the owner account: ${token}`)
})

const purge = (): void => {
  const n = applyRetention()
  if (n) console.log(`Retention: ${n} old records deleted`)
}
purge()
setInterval(purge, 24 * 3600 * 1000).unref()
