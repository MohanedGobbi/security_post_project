import { FACULTY } from '@shared/faculty'
import * as db from './db'
import { installTemplates, updateTemplateRegisters } from './registers'

/**
 * First start of the program: settings, feature switches, the first accounts and the faculty's registers.
 * Runs only while there are no accounts; the registers are also completed on later starts (a newer version may add some).
 */
export function seedFaculty(): void {
  if (db.userCount() === 0) {
    db.setSettings({ ...db.getSettings(), siteName: FACULTY.siteName, postName: FACULTY.postName })
    db.setFeatures(FACULTY.features)
    const ids = FACULTY.accounts.map((a) => db.createUser(a.name, a.role, a.pin, a.language))
    db.audit(ids[0], 'setup')
  }
  const admin = db.listUsers(true).find((u) => u.role === 'admin')
  if (admin) {
    installTemplates(FACULTY.registerTemplates, admin.id)
    updateTemplateRegisters(admin.id)
  }
}
