// Writes resources/version.json (version, commit, build date) before a package is built.
// electron-builder copies resources/ next to the program, so the installed program and the updater can read it:
// /opt/FacultySecurity/resources/version.json on Linux.
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
let commit = process.env.GITHUB_SHA || ''
if (!commit) {
  try { commit = execSync('git rev-parse HEAD', { cwd: root }).toString().trim() } catch { commit = 'unknown' }
}
const info = { version, commit, built: new Date().toISOString() }
writeFileSync(join(root, 'resources', 'version.json'), JSON.stringify(info, null, 2) + '\n')
console.log(`resources/version.json: ${JSON.stringify(info)}`)
