import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"
import type { Session } from "next-auth"

// "Act as this verified person" for the AI connector, which has a bearer token, not a cookie.
// getSession() checks this store first. ONLY features/mcp/server/principal.ts may call
// runAsDelegate, after verifying the token - any other caller would be an auth bypass.

const globalForDelegate = globalThis as unknown as {
  dnmsDelegatedSession?: AsyncLocalStorage<Session>
}

// On globalThis like the tenant store: a second module instance would silently read as empty.
const storage: AsyncLocalStorage<Session> = (globalForDelegate.dnmsDelegatedSession ??=
  new AsyncLocalStorage<Session>())

/** The inner `await` matters, as in runWithTenant. */
export function runAsDelegate<T>(session: Session, fn: () => Promise<T>): Promise<T> {
  return storage.run(session, async () => await fn())
}

export function delegatedSession(): Session | null {
  return storage.getStore() ?? null
}
