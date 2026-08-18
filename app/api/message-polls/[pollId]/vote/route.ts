import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { canAccessProject } from "@/features/projects/server/project-access"
import { votePoll, findPollParent } from "@/server/message-cards"

export const runtime = "nodejs"

/**
 * POST /api/message-polls/:pollId/vote  { optionId }
 *
 * ONE route for both surfaces, because a vote is a vote. It resolves which
 * conversation the poll lives in and applies that surface's rule: chat wants
 * membership, a project reply wants project access. Nothing is read from the
 * request except which option was clicked.
 */
export const POST = withSession(async (req: NextRequest, ctx, session) => {
  const pollId = ctx.params.pollId
  const me = session.user.id

  const parent = await findPollParent(pollId)
  if (!parent) return NextResponse.json({ error: "Poll not found" }, { status: 404 })

  if (parent.chatMessage) {
    const member = await db.conversationParticipant.findUnique({
      where: {
        conversationId_employeeId: {
          conversationId: parent.chatMessage.conversationId,
          employeeId: me,
        },
      },
      select: { conversationId: true },
    })
    // 404, not 403: confirming the poll exists is itself a leak.
    if (!member) return NextResponse.json({ error: "Poll not found" }, { status: 404 })
  } else if (parent.projectReply) {
    const allowed = await canAccessProject(session, parent.projectReply.message.projectId)
    if (!allowed) return NextResponse.json({ error: "Poll not found" }, { status: 404 })
  } else {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 })
  }

  const { optionId } = await req.json()
  if (!optionId) return NextResponse.json({ error: "Pick an option" }, { status: 400 })

  const result = await votePoll(pollId, String(optionId), me)
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json({ data: { ok: true } })
})
