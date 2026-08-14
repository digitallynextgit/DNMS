import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { createAuditLog } from "@/lib/audit"

// =============================================================================
// One call, right table.
// =============================================================================
// A shared service (the project mailer) is now driven by BOTH staff and client
// accounts. Its audit calls cannot simply keep calling createAuditLog, because
// `audit_logs.actor_id` is a foreign key to `employees` - a client id there is a
// database error, so the first campaign a client sent would 500 after doing the
// work.
//
// So dispatch on who is acting:
//   staff  -> audit_logs         (unchanged; every existing caller is unaffected)
//   client -> client_activity_logs
//
// Call sites stay honest by not having to know which is which. Adding a client
// path to any other staff service is now one import away.
// =============================================================================

export interface ActivityInput {
  action: string
  module: string
  entityType?: string
  entityId?: string
  /**
   * A plain-language line shown to the client in their own Activity view.
   * Written at the time of the action, because only here do we still know what
   * "campaign:create" actually meant. Ignored for staff (audit_logs has no such
   * column and the staff UI derives its wording from the action).
   */
  summary?: string
  changes?: object
  /** The resolved project id, so the record can be scoped to one project. */
  projectId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

/** True when this session belongs to an external client-portal account. */
export function isClientSession(session: Session | null): boolean {
  return session?.user?.kind === "client"
}

/**
 * Record an action against whichever log fits the actor.
 *
 * Never throws: a failed log must not roll back work the user already saw
 * succeed. It is written after the operation for that reason, and a failure is
 * reported to the server console rather than to the person.
 */
export async function recordActivity(session: Session | null, input: ActivityInput): Promise<void> {
  try {
    if (!isClientSession(session)) {
      await createAuditLog(session, {
        action: input.action,
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId,
        changes: input.changes,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      })
      return
    }

    const clientUserId = session?.user?.id
    if (!clientUserId) return

    await db.clientActivityLog.create({
      data: {
        clientUserId,
        projectId: input.projectId ?? null,
        action: input.action,
        module: input.module,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        changes: (input.changes as never) ?? undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
  } catch (err) {
    console.error("[activity] could not record", input.action, err)
  }
}
