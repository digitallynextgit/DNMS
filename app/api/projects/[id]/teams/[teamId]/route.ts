import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { PERMISSIONS } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import type { Session } from "next-auth"

// PATCH /api/projects/[id]/teams/[teamId] - rename / change manager (Admin only)
export const PATCH = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, teamId } = ctx.params
      const body = await req.json()
      const { name, description, managerId } = body

      const team = await db.projectTeam.findUnique({
        where: { id: teamId },
        include: { members: true },
      })
      if (!team || team.projectId !== projectId) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 })
      }

      const data: Record<string, unknown> = {}

      if (name !== undefined) {
        if (!name.trim())
          return NextResponse.json({ error: "Team name cannot be empty" }, { status: 400 })
        const dupe = await db.projectTeam.findFirst({
          where: { projectId, name: name.trim(), NOT: { id: teamId } },
        })
        if (dupe)
          return NextResponse.json(
            { error: "Another team in this project already has that name" },
            { status: 409 },
          )
        data.name = name.trim()
      }

      if (description !== undefined) data.description = description?.trim() || null

      // Manager change - must be an existing member
      if (managerId !== undefined && managerId !== team.managerId) {
        if (managerId === null) {
          // Removing manager - only allowed if team is empty or only manager left
          if (team.members.length > 1) {
            return NextResponse.json(
              {
                error:
                  "Cannot remove manager while team has other members. Promote another member first.",
              },
              { status: 422 },
            )
          }
          data.managerId = null
        } else {
          const isMember = team.members.some((m) => m.employeeId === managerId)
          if (!isMember) {
            return NextResponse.json(
              { error: "Selected manager must already be a member of this team" },
              { status: 422 },
            )
          }
          data.managerId = managerId
        }
      }

      const updated = await db.projectTeam.update({
        where: { id: teamId },
        data,
        include: {
          manager: { select: { id: true, firstName: true, lastName: true } },
          members: {
            include: { employee: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
      })

      await createAuditLog(session, {
        action: "UPDATE",
        module: "project",
        entityType: "ProjectTeam",
        entityId: teamId,
        changes: data as object,
      })

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[PROJECT_TEAM_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// DELETE /api/projects/[id]/teams/[teamId] - delete team (cascades members + tasks)
export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, teamId } = ctx.params

      const team = await db.projectTeam.findUnique({ where: { id: teamId } })
      if (!team || team.projectId !== projectId) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 })
      }

      await db.projectTeam.delete({ where: { id: teamId } })

      await createAuditLog(session, {
        action: "DELETE",
        module: "project",
        entityType: "ProjectTeam",
        entityId: teamId,
        changes: { name: team.name },
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[PROJECT_TEAM_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
