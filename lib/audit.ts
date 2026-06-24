import type { Session } from "next-auth"
import { db } from "@/server/db"
import { SYSTEM_ROLES } from "@/lib/constants"

interface AuditLogInput {
  action: string
  module: string
  entityType?: string
  entityId?: string
  // `object` (not Record<string, unknown>) so callers can pass loosely-typed
  // change payloads / `as object` casts; it's stored as Prisma JSON regardless.
  changes?: object
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Write an audit log entry.
 *
 * Actions performed by a super_admin (the CEO role) are intentionally NOT
 * recorded - that account is invisible to the system. Pass the session of the
 * actor; if it carries the super_admin role the call returns silently.
 */
export async function createAuditLog(session: Session | null, input: AuditLogInput): Promise<void> {
  if (session?.user?.roles?.includes(SYSTEM_ROLES.SUPER_ADMIN)) return

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

/** Returns true when the given session represents a super_admin account. */
export function isSuperAdminSession(session: Session | null): boolean {
  return !!session?.user?.roles?.includes(SYSTEM_ROLES.SUPER_ADMIN)
}

/**
 * The actor id to stamp onto a record's "who did this" field (approver,
 * reviewer, etc.). Returns null for a super_admin so that account is never named
 * on a record - the same invisibility policy as createAuditLog. The action still
 * happens (status + timestamps are set normally); only the identity is withheld,
 * so completion logic must key off timestamps/status, never the stamped id.
 */
export function actorStampId(session: Session | null): string | null {
  return isSuperAdminSession(session) ? null : (session?.user?.id ?? null)
}
