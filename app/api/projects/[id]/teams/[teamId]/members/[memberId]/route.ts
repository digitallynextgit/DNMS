import { NextRequest, NextResponse } from "next/server"
import { canStaffTeam, resolveProjectId } from "@/features/projects/server/project-access"
import { syncProjectFolderAccessAsync } from "@/features/projects/server/project-drive.service"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { ACCOUNT_MANAGER_TEAM } from "@/features/projects/lib/project-teams"
import { createNotification } from "@/lib/notifications"
import { createAuditLog } from "@/lib/audit"
import type { Session } from "next-auth"

// Removing the manager while the team has other members is refused (422).
export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { teamId, memberId } = ctx.params
      // Plain withSession, so resolve the slug here.
      const projectId = await resolveProjectId(ctx.params.id)
      if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })

      const team = await db.projectTeam.findUnique({
        where: { id: teamId },
        include: { members: true },
      })
      if (!team || team.projectId !== projectId) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 })
      }

      const member = team.members.find((m) => m.id === memberId)
      if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 })

      if (!(await canStaffTeam(session, projectId, teamId))) {
        return NextResponse.json(
          { error: "Only a project admin, the Account Manager or this team's manager can do this" },
          { status: 403 },
        )
      }

      if (team.name === ACCOUNT_MANAGER_TEAM) {
        const project = await db.project.findUnique({
          where: { id: projectId },
          select: { ownerId: true },
        })
        if (project?.ownerId === member.employeeId) {
          return NextResponse.json(
            {
              error:
                "This is the project's Account Manager. Choose a new Account Manager in Edit project first.",
            },
            { status: 422 },
          )
        }
      }

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
        // Their seats on this team's calendar rows go too; seats on their other teams stay.
        await tx.projectWorkbookTeamMember.deleteMany({
          where: { employeeId: member.employeeId, workbookTeam: { teamId } },
        })
        // If we just removed the only member (who was the manager), null out managerId
        if (member.employeeId === team.managerId) {
          await tx.projectTeam.update({ where: { id: teamId }, data: { managerId: null } })
        }
      })

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
      syncProjectFolderAccessAsync(projectId)

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[TEAM_MEMBER_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
