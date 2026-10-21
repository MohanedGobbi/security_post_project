import type { Labels, Permission, User } from './types'

/**
 * What an account may do beyond what its level of registers allows (each register lists the levels that may fill and close it).
 * A level is a named set of these permissions; an administrator makes as many levels as the faculty needs.
 * The administrator level always has everything, and alone may manage accounts, levels, registers, settings and the audit trail.
 */
export const PERMISSIONS: Permission[] = ['visitors', 'history', 'cardPictures', 'students', 'studentsEdit', 'exports', 'correctAny', 'shiftHandover']

/** The levels every installation starts with. Their names and permissions can be edited; they cannot be deleted. */
export const BUILTIN_LEVELS: { key: string; labels: Labels; permissions: Permission[]; sort: number }[] = [
  {
    key: 'guard', sort: 1, labels: { ar: 'حارس', fr: 'Agent', en: 'Guard' },
    permissions: ['visitors', 'history', 'cardPictures', 'students']
  },
  {
    key: 'leader', sort: 2, labels: { ar: 'رئيس فرقة الأمن', fr: 'Chef d’équipe', en: 'Team leader' },
    permissions: ['visitors', 'history', 'cardPictures', 'students', 'studentsEdit', 'exports', 'correctAny', 'shiftHandover']
  },
  { key: 'admin', sort: 3, labels: { ar: 'مسؤول', fr: 'Administrateur', en: 'Administrator' }, permissions: PERMISSIONS }
]

export const isAdmin = (u: Pick<User, 'role'>): boolean => u.role === 'admin'

/** Administrators may do everything; the others what their level gives them. */
export const can = (u: Pick<User, 'role' | 'permissions'>, p: Permission): boolean => u.role === 'admin' || (u.permissions ?? []).includes(p)
