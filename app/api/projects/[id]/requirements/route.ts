import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import {
  createRequirement,
  REQUIREMENT_SELECT,
} from "@/features/projects/server/requirements.service"
import type { Session } from "next-auth"

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

// Any project participant may raise one - whoever hits the wall is usually not the lead.
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

      // Defaults to the Account Manager, who owns the client relationship.
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

      // Only tasks that really belong to this project may be linked.
      const requestedTaskIds: string[] = Array.isArray(body.blockedTaskIds)
        ? body.blockedTaskIds.filter((v: unknown) => typeof v === "string")
        : []
      const blockedTasks =
        requestedTaskIds.length > 0
          ? await db.projectTask.findMany({
              where: { id: { in: requestedTaskIds }, projectId },
              select: { id: true, teamId: true },
            })
          : []
      const blockedTaskIds = blockedTasks.map((t) => t.id)

      // A named team of this project, else the blocked task's team, else the raiser's team when
      // they are on just one (someone on several teams leaves it unset rather than guessing).
      const taskTeamId = blockedTasks.find((t) => t.teamId)?.teamId ?? null
      let teamId: string | null = null
      if (typeof body.teamId === "string" && body.teamId) {
        const team = await db.projectTeam.findFirst({
          where: { id: body.teamId, projectId },
          select: { id: true },
        })
        if (!team) return NextResponse.json({ error: "Team not found" }, { status: 422 })
        teamId = team.id
      } else if (taskTeamId) {
        teamId = taskTeamId
      } else {
        const memberships = await db.projectTeamMember.findMany({
          where: { projectId, employeeId: session.user.id },
          select: { teamId: true },
          take: 2,
        })
        teamId = memberships.length === 1 ? memberships[0]!.teamId : null
      }

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
