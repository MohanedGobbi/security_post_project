import { AsyncLocalStorage } from 'node:async_hooks'
import type { User } from '@shared/types'

/** Who is signed in. The desktop window has one session; every browser of the deanship's network access has its own. */
export interface Session { user: User | null }

/** The context of a call that came over the faculty network: its session, its address, and the files it produced (PDF, Excel). */
export interface RemoteContext {
  session: Session
  ip: string
  files: { name: string; path: string }[]
}

export const remoteStore = new AsyncLocalStorage<RemoteContext>()
export const remoteContext = (): RemoteContext | undefined => remoteStore.getStore()
