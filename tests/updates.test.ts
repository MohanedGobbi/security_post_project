// Tests of the program's side of the automatic updates (src/main/updates.ts): the status the administrator sees and the
// "Check for updates now" request. Run with: npm test (node --test, no Electron needed).
import { strict as assert } from 'node:assert'
import { mkdirSync, mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { readStatus, readVersionFile, requestUpdateCheck, updateInfo, writeRunningMarker, type RequestContext } from '../src/main/updates.ts'

let dir = ''
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'secreg-updates-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const installed = { version: '0.1.0', commit: 'abc1234def', built: '2026-11-08T10:00:00.000Z' }
const setUp = (): void => mkdirSync(join(dir, 'request'))
const report = (o: unknown): void => writeFileSync(join(dir, 'status.json'), typeof o === 'string' ? o : JSON.stringify(o))
const goodReport = { state: 'up_to_date', installed: '0.1.0', latest: '0.1.0', message: 'Version 0.1.0 is the latest', timestamp: '2026-11-09T02:14:03.120+00:00' }
const ctx = (o: Partial<RequestContext> = {}): RequestContext => ({ isAdmin: true, demo: false, by: 'admin', checkPin: () => {}, ...o })

describe('update status', () => {
  it('is off when the updater is not set up (no request folder), even with a report lying around', () => {
    report(goodReport)
    const info = updateInfo(installed, dir)
    assert.equal(info.enabled, false)
    assert.equal(info.pending, false)
    assert.equal(info.status, null)
    assert.equal(info.installed, '0.1.0')
    assert.equal(info.commit, 'abc1234def')
  })

  it('reads the updater report', () => {
    setUp()
    report(goodReport)
    const info = updateInfo(installed, dir)
    assert.equal(info.enabled, true)
    assert.deepEqual(info.status, goodReport)
  })

  it('says when a request is pending', () => {
    setUp()
    writeFileSync(join(dir, 'request', 'check-now'), '{}')
    assert.equal(updateInfo(installed, dir).pending, true)
  })

  it('ignores garbage: unreadable JSON, unknown states, missing or bad timestamps, wrong types', () => {
    setUp()
    for (const bad of ['', '{', 'null', '[]', '"updated"',
      { ...goodReport, state: 'rebooting' }, { ...goodReport, state: 3 }, { ...goodReport, timestamp: 'yesterday' },
      { state: 'updated' }]) {
      report(bad)
      assert.equal(readStatus(dir), null, `should ignore ${JSON.stringify(bad)}`)
    }
    rmSync(join(dir, 'status.json'))
    assert.equal(readStatus(dir), null)
  })

  it('keeps known fields only and cuts long or odd values', () => {
    setUp()
    report({ ...goodReport, latest: 7, message: 'x'.repeat(2000), extra: 'drop me' })
    const s = readStatus(dir)!
    assert.equal(s.latest, null)
    assert.equal(s.message.length, 500)
    assert.equal('extra' in s, false)
  })
})

describe('check for updates now', () => {
  it('needs the administrator', () => {
    setUp()
    assert.throws(() => requestUpdateCheck(ctx({ isAdmin: false }), dir), /error\.forbidden/)
    assert.equal(existsSync(join(dir, 'request', 'check-now')), false)
  })

  it('needs the PIN again', () => {
    setUp()
    assert.throws(() => requestUpdateCheck(ctx({ checkPin: () => { throw new Error('error.supervisorPin') } }), dir), /supervisorPin/)
    assert.equal(existsSync(join(dir, 'request', 'check-now')), false)
  })

  it('is refused in a demonstration, before the PIN is even checked', () => {
    setUp()
    let asked = false
    assert.throws(() => requestUpdateCheck(ctx({ demo: true, checkPin: () => { asked = true } }), dir), /error\.demoRefused/)
    assert.equal(asked, false)
    assert.equal(existsSync(join(dir, 'request', 'check-now')), false)
  })

  it('is refused when updates are not set up', () => {
    assert.throws(() => requestUpdateCheck(ctx(), dir), /error\.updatesOff/)
  })

  it('only leaves a request file for the updater', () => {
    setUp()
    requestUpdateCheck(ctx({ by: 'مسؤول الأمن' }), dir)
    const req = JSON.parse(readFileSync(join(dir, 'request', 'check-now'), 'utf8'))
    assert.equal(req.by, 'مسؤول الأمن')
    assert.ok(Date.parse(req.requestedAt))
    assert.equal(updateInfo(installed, dir).pending, true)
  })
})

describe('version file and health report', () => {
  it('reads the version file of the package, null when missing or broken', () => {
    assert.equal(readVersionFile(dir), null)
    writeFileSync(join(dir, 'version.json'), '{"version": ""}')
    assert.equal(readVersionFile(dir), null)
    writeFileSync(join(dir, 'version.json'), JSON.stringify({ version: '0.2.0', commit: 'f00', built: '2026-11-08T00:00:00Z' }))
    assert.deepEqual(readVersionFile(dir), { version: '0.2.0', commit: 'f00', built: '2026-11-08T00:00:00Z' })
  })

  it('writes running.json for the updater', () => {
    writeRunningMarker(dir, '0.2.0', 'ok')
    const m = JSON.parse(readFileSync(join(dir, 'running.json'), 'utf8'))
    assert.equal(m.version, '0.2.0')
    assert.equal(m.state, 'ok')
    writeRunningMarker(join(dir, 'missing'), '0.2.0', 'ok') // no throw
  })
})
