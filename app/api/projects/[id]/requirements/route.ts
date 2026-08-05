import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import {
  createRequirement,
  REQUIREMENT_SELECT,
} from "@/features/projects/server/requirements.service"
import type { Session } from "next-auth"

// GET /api/projects/[id]/requirements - everything the project is waiting on.
// Open items first, then by the date they are needed.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const requirements = await db.projectRequirement.findMany({
        where: { projectId: ctx.params.id },
        select: REQUIREMENT_SELECT,
        orderBy: [{ status: "asc" }, { neededBy: "asc" }, { createdAt: "desc" }],
      })
      return NextResponse.json({ data: requirements })
    } catch (error) {
      console.error("[PROJECT_REQUIREMENTS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// POST /api/projects/[id]/requirements - raise one.
//
// Any project participant may raise a requirement: the person who hits the wall
// is usually not the lead, and making them ask their manager to ask on their
// behalf is how blockers stay invisible. `withProjectAccess` already limits this
// to people on the project.
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const projectId = ctx.params.id
      const body = await req.json()
      const title = typeof body.title === "string" ? body.title.trim() : ""
      if (!title) return NextResponse.json({ error: "Title is required" }, { status: 422 })

      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
      })
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

      // Default recipient is the Account Manager - they own the client
      // relationship, so documents and credentials are theirs to chase.
      const requestedFromId: string = body.requestedFromId || project.ownerId
      const recipient = await db.employee.findUnique({
        where: { id: requestedFromId },
        select: { id: true, isActive: true },
      })
      if (!recipient?.isActive) {
        return NextResponse.json(
          { error: "The person this is requested from is not an active employee" },
          { status: 422 },
        )
      }

      // The raiser's own team on this project, unless one was named explicitly.
      let teamId: string | null = body.teamId || null
      if (!teamId) {
        const membership = await db.projectTeamMember.findFirst({
          where: { projectId, employeeId: session.user.id },
          select: { teamId: true },
        })
        teamId = membership?.teamId ?? null
      }

      // Only tasks that really belong to this project may be linked.
      const requestedTaskIds: string[] = Array.isArray(body.blockedTaskIds)
        ? body.blockedTaskIds.filter((v: unknown) => typeof v === "string")
        : []
      const blockedTaskIds =
        requestedTaskIds.length > 0
          ? (
              await db.projectTask.findMany({
                where: { id: { in: requestedTaskIds }, projectId },
                select: { id: true },
              })
            ).map((t) => t.id)
          : []

      const requirement = await createRequirement({
        projectId,
        teamId,
        raisedById: session.user.id,
        requestedFromId,
        type: typeof body.type === "string" ? body.type : "OTHER",
        title,
        details:
          typeof body.details === "string" && body.details.trim() ? body.details.trim() : null,
        neededBy: body.neededBy ? new Date(body.neededBy) : null,
        blockedTaskIds,
      })

      return NextResponse.json({ data: requirement }, { status: 201 })
    } catch (error) {
      console.error("[PROJECT_REQUIREMENTS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
