import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { logActivity } from "@/features/projects/server/activity"
import { createNotifications } from "@/lib/notifications"
import type { Session } from "next-auth"

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  profilePhoto: true,
  designation: { select: { title: true } },
}

/**
 * Keeps only the ids that genuinely belong to the project (Account Manager or a
 * member of any team) so a mention can never notify someone off the project.
 */
export async function resolveProjectMemberIds(
  projectId: string,
  candidateIds: string[],
): Promise<string[]> {
  const ids = [...new Set(candidateIds.filter(Boolean))]
  if (ids.length === 0) return []
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      teams: { select: { members: { select: { employeeId: true } } } },
    },
  })
  if (!project) return []
  const valid = new Set<string>()
  if (project.ownerId) valid.add(project.ownerId)
  for (const t of project.teams) for (const m of t.members) valid.add(m.employeeId)
  return ids.filter((id) => valid.has(id))
}

// GET /api/projects/[id]/messages
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId } = await ctx.params
      const messages = await db.projectMessage.findMany({
        where: { projectId },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        include: {
          author: { select: AUTHOR_SELECT },
          _count: { select: { replies: true } },
          // Last reply powers the chat-list preview + "last activity" ordering.
          replies: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              content: true,
              createdAt: true,
              author: { select: { firstName: true, lastName: true } },
            },
          },
        },
      })

      // Decorate each thread with a compact last-message preview + last-activity
      // timestamp, then order chats by most-recent activity (pinned first).
      const data = messages
        .map(({ replies, ...m }) => {
          const last = replies[0]
          return {
            ...m,
            lastReply: last
              ? {
                  content: last.content,
                  createdAt: last.createdAt,
                  authorName: `${last.author.firstName} ${last.author.lastName}`.trim(),
                }
              : null,
            lastActivityAt: last ? last.createdAt : m.createdAt,
          }
        })
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
          return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
        })

      return NextResponse.json({ data })
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

      const mentionedIds = await resolveProjectMemberIds(
        projectId,
        Array.isArray(body.mentionedIds) ? body.mentionedIds : [],
      )

      const message = await db.projectMessage.create({
        data: { projectId, authorId: session.user.id, title, content, mentionedIds },
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

      // Notify everyone tagged (never the author themselves).
      const toNotify = mentionedIds.filter((id) => id !== session.user.id)
      if (toNotify.length > 0) {
        const author = message.author
        await createNotifications(
          toNotify.map((employeeId) => ({
            employeeId,
            title: "You were mentioned",
            message: `${author.firstName} ${author.lastName} mentioned you in "${title}".`,
            type: "info",
            link: `/projects/${projectId}?tab=messages`,
          })),
          { force: true },
        )
      }

      return NextResponse.json({ data: message }, { status: 201 })
    } catch (error) {
      console.error("[PROJECT_MESSAGES_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
