import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"
import type { Session } from "next-auth"

// =============================================================================
// Delegated session - "act as this verified person" for the AI connector.
//
// Almost every service learns who is calling from `getSession()`, which reads
// the browser's session cookie. An AI app (Claude, ChatGPT) calling /api/mcp
// carries an OAuth bearer token instead, so without this every one of those
// services would answer 401.
//
// The MCP layer verifies the token, rebuilds that person's session (live roles
// and permissions, see features/mcp/server/principal.ts) and runs the work
// inside `runAsDelegate`. `getSession()` checks this store FIRST, so
// requireSession / requirePermission / withAuth / createAuditLog all see the
// real person - and nothing else changes. Browser requests never enter the
// store, so for them this file does nothing.
//
// Only features/mcp/server/principal.ts may call `runAsDelegate`, and only
// after verifying a token. Anything else calling it would be an auth bypass.
// =============================================================================

const globalForDelegate = globalThis as unknown as {
  dnmsDelegatedSession?: AsyncLocalStorage<Session>
}

// Pinned to globalThis for the same reason as the tenant store
// (server/tenant-context.ts): Turbopack HMR re-evaluates modules, and a second
// AsyncLocalStorage instance would silently read as empty.
const storage: AsyncLocalStorage<Session> = (globalForDelegate.dnmsDelegatedSession ??=
  new AsyncLocalStorage<Session>())

/**
 * Run `fn` as `session`. The `await` inside matters for the same reason as in
 * runWithTenant: a lazy Prisma promise handed back out would run after the
 * store had gone.
 */
export function runAsDelegate<T>(session: Session, fn: () => Promise<T>): Promise<T> {
  return storage.run(session, async () => await fn())
}

/** The delegated session for the current execution, or null (the normal case). */
export function delegatedSession(): Session | null {
  return storage.getStore() ?? null
}
