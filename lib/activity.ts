import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { createAuditLog } from "@/lib/audit"

// Staff actions go to audit_logs, client actions to client_activity_logs (audit_logs.actor_id must be an employee).

export interface ActivityInput {
  action: string
  module: string
  entityType?: string
  entityId?: string
  /** Plain-language line for the client's Activity view. Ignored for staff. */
  summary?: string
  changes?: object
  projectId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export function isClientSession(session: Session | null): boolean {
  return session?.user?.kind === "client"
}

/** Never throws: a failed log must not roll back work the user already saw succeed. */
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
