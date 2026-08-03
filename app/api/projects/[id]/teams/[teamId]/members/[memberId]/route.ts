import { NextRequest, NextResponse } from "next/server"
import { canStaffTeam } from "@/features/projects/server/project-access"
import { syncProjectFolderAccessAsync } from "@/features/projects/server/project-drive.service"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
import { createAuditLog } from "@/lib/audit"
import type { Session } from "next-auth"

// DELETE /api/projects/[id]/teams/[teamId]/members/[memberId]
// Manager swap rule: if removing the manager and team has other members → 422
export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, teamId, memberId } = ctx.params

      const team = await db.projectTeam.findUnique({
        where: { id: teamId },
        include: { members: true },
      })
      if (!team || team.projectId !== projectId) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 })
      }

      const member = team.members.find((m) => m.id === memberId)
      if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 })

      // Authorisation: project admin / Account Manager OR THIS team's manager
      if (!(await canStaffTeam(session, projectId, teamId))) {
        return NextResponse.json(
          { error: "Only a project admin, the Account Manager or this team's manager can do this" },
          { status: 403 },
        )
      }

      // Manager swap rule
      if (member.employeeId === team.managerId && team.members.length > 1) {
        return NextResponse.json(
          {
            error:
              "Cannot remove the team manager while team has other members. Please promote another member to manager first.",
          },
          { status: 422 },
        )
      }

      await db.$transaction(async (tx) => {
        await tx.projectTeamMember.delete({ where: { id: memberId } })
        // If we just removed the only member (who was the manager), null out managerId
        if (member.employeeId === team.managerId) {
          await tx.projectTeam.update({ where: { id: teamId }, data: { managerId: null } })
        }
      })

      // Notify removed employee
      try {
        const projectName = (
          await db.project.findUnique({ where: { id: projectId }, select: { name: true } })
        )?.name
        await createNotification({
          employeeId: member.employeeId,
          title: "Removed from team",
          message: `You've been removed from the "${team.name}" team in ${projectName}.`,
          type: "info",
          link: "/projects",
        })
      } catch (_e) {
        /* non-blocking */
      }

      await createAuditLog(session, {
        action: "REMOVE",
        module: "project",
        entityType: "ProjectTeamMember",
        entityId: memberId,
        changes: { teamId, employeeId: member.employeeId },
      })

      // Revoke the removed member's Drive access (fire-and-forget).
      syncProjectFolderAccessAsync(ctx.params.id)

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[TEAM_MEMBER_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
