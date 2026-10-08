import type { Session } from "next-auth"
import { db } from "@/server/db"
import { SYSTEM_ROLES } from "@/lib/constants"

interface AuditLogInput {
  action: string
  module: string
  entityType?: string
  entityId?: string
  // `object` so loosely typed payloads can be passed; it's stored as JSON anyway.
  changes?: object
  ipAddress?: string | null
  userAgent?: string | null
}

/** admin_ (CEO) actions are never recorded - that account is invisible to the system. */
export async function createAuditLog(session: Session | null, input: AuditLogInput): Promise<void> {
  if (session?.user?.roles?.includes(SYSTEM_ROLES.ADMIN_)) return

  await db.auditLog.create({
    data: {
      actorId: session?.user?.id ?? null,
      action: input.action,
      module: input.module,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      changes: (input.changes as never) ?? undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  })
}

export function isAdmin_Session(session: Session | null): boolean {
  return !!session?.user?.roles?.includes(SYSTEM_ROLES.ADMIN_)
}

/**
 * Actor id for "who did this" fields. Null for admin_ (never named on a record), so completion
 * logic must key off status/timestamps, never this id.
 */
export function actorStampId(session: Session | null): string | null {
  return isAdmin_Session(session) ? null : (session?.user?.id ?? null)
}
