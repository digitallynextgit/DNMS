import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { logActivity } from "@/features/projects/server/activity"
import type { Session } from "next-auth"

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  profilePhoto: true,
  designation: { select: { title: true } },
}

// GET /api/projects/[id]/messages
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId } = await ctx.params
      const messages = await db.projectMessage.findMany({
        where: { projectId },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        include: { author: { select: AUTHOR_SELECT } },
      })
      return NextResponse.json({ data: messages })
    } catch (error) {
      console.error("[PROJECT_MESSAGES_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// POST /api/projects/[id]/messages
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId } = await ctx.params
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      })
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

      const body = await req.json()
      const title = body.title?.trim()
      const content = body.content?.trim()
      if (!title || !content)
        return NextResponse.json({ error: "Title and content are required" }, { status: 400 })

      const message = await db.projectMessage.create({
        data: { projectId, authorId: session.user.id, title, content },
        include: { author: { select: AUTHOR_SELECT } },
      })

      await logActivity({
        projectId,
        actorId: session.user.id,
        type: "MESSAGE_POSTED",
        entityType: "MESSAGE",
        entityId: message.id,
        meta: { title },
      })

      return NextResponse.json({ data: message }, { status: 201 })
    } catch (error) {
      console.error("[PROJECT_MESSAGES_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
