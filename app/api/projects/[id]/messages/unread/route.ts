import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import type { Session } from "next-auth"

// GET  /api/projects/[id]/messages/unread  -> { count } of messages + replies
//       posted by others since this user last opened the Messages tab.
// POST /api/projects/[id]/messages/unread  -> mark the tab as seen (now).
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId } = await ctx.params
      const me = session.user.id
      const read = await db.projectMessageRead.findUnique({
        where: { projectId_employeeId: { projectId, employeeId: me } },
        select: { lastSeenAt: true },
      })
      const since = read?.lastSeenAt
      const createdFilter = since ? { gt: since } : undefined

      const [newMessages, newReplies] = await Promise.all([
        db.projectMessage.count({
          where: {
            projectId,
            authorId: { not: me },
            ...(createdFilter && { createdAt: createdFilter }),
          },
        }),
        db.projectMessageReply.count({
          where: {
            message: { projectId },
            authorId: { not: me },
            ...(createdFilter && { createdAt: createdFilter }),
          },
        }),
      ])

      return NextResponse.json({ data: { count: newMessages + newReplies } })
    } catch (error) {
      console.error("[PROJECT_MESSAGES_UNREAD_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId } = await ctx.params
      const me = session.user.id
      await db.projectMessageRead.upsert({
        where: { projectId_employeeId: { projectId, employeeId: me } },
        create: { projectId, employeeId: me },
        update: { lastSeenAt: new Date() },
      })
      return NextResponse.json({ data: { ok: true } })
    } catch (error) {
      console.error("[PROJECT_MESSAGES_UNREAD_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
