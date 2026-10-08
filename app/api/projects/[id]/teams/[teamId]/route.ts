import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectManager } from "@/features/projects/server/project-access"
import { createAuditLog } from "@/lib/audit"
import { TEAMS_ARE_FIXED } from "@/features/projects/lib/project-teams"
import type { Session } from "next-auth"

// Only the manager can change: team names/descriptions are fixed (features/projects/lib/project-teams.ts).
export const PATCH = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, teamId } = ctx.params
      const body = (await req.json()) as {
        name?: unknown
        description?: unknown
        managerId?: string | null
      }

      if (body.name !== undefined || body.description !== undefined) {
        return NextResponse.json({ error: TEAMS_ARE_FIXED }, { status: 405 })
      }
      if (body.managerId === undefined) {
        return NextResponse.json(
          { error: "Nothing to change - only managerId can be updated" },
          { status: 400 },
        )
      }
      const { managerId } = body

      const team = await db.projectTeam.findUnique({
        where: { id: teamId },
        include: { members: true },
      })
      if (!team || team.projectId !== projectId) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 })
      }

      const data: { managerId?: string | null } = {}

      if (managerId !== team.managerId) {
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
        changes: data,
      })

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[PROJECT_TEAM_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// Refused: teams are fixed - remove people from a team instead.
export function DELETE() {
  return NextResponse.json({ error: TEAMS_ARE_FIXED }, { status: 405, headers: { Allow: "PATCH" } })
}
