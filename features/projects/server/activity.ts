import { db } from "@/server/db"
import { Prisma } from "@prisma/client"

export type ActivityType =
  | "TASK_CREATED"
  | "TASK_STATUS_CHANGED"
  | "TASK_UPDATED"
  | "TASK_DELETED"
  | "TASK_APPROVED"
  | "TASK_REJECTED"
  | "COMMENT_ADDED"
  | "TEAM_CREATED"
  | "TEAM_MEMBER_ADDED"
  | "TEAM_MEMBER_REMOVED"
  | "MESSAGE_POSTED"
  | "MILESTONE_TOGGLED"

export async function logActivity(params: {
  projectId: string
  actorId: string
  type: ActivityType
  entityType?: string
  entityId?: string
  meta?: Record<string, unknown>
}) {
  try {
    await db.projectActivity.create({
      data: {
        projectId: params.projectId,
        actorId: params.actorId,
        type: params.type,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        ...(params.meta !== undefined && { meta: params.meta as Prisma.InputJsonValue }),
      },
    })
  } catch {
    // Activity logging is best-effort - never fail the main request
  }
}
