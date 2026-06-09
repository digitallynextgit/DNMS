import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
import { sendEmail } from "@/lib/mailer"
import { createAuditLog } from "@/lib/audit"
import type { Session } from "next-auth"

// PATCH /api/projects/[id]/teams/[teamId]/members/[memberId]/promote
// Admin only - make this member the new manager. Previous manager stays as a regular member.
export const PATCH = withAuth(
  PERMISSIONS.PROJECT_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, teamId, memberId } = ctx.params

      const team = await db.projectTeam.findUnique({
        where: { id: teamId },
        include: {
          members: {
            include: { employee: { select: { id: true, firstName: true, email: true } } },
          },
        },
      })
      if (!team || team.projectId !== projectId) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 })
      }

      const member = team.members.find((m) => m.id === memberId)
      if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 })

      if (team.managerId === member.employeeId) {
        return NextResponse.json({ error: "This member is already the manager" }, { status: 400 })
      }

      await db.projectTeam.update({
        where: { id: teamId },
        data: { managerId: member.employeeId },
      })

      // Notify new manager
      try {
        const projectName = (
          await db.project.findUnique({ where: { id: projectId }, select: { name: true } })
        )?.name
        await createNotification({
          employeeId: member.employeeId,
          title: "Promoted to Team Manager",
          message: `You're now the manager of the "${team.name}" team in ${projectName}.`,
          type: "success",
          link: `/projects/${projectId}`,
        })
        await sendEmail({
          to: member.employee.email,
          subject: `You're now Team Manager of ${team.name}`,
          html: `<p>Hi ${member.employee.firstName},</p>
            <p>You've been promoted to manage the <strong>${team.name}</strong> team in <strong>${projectName}</strong>.</p>
            <p>You can now create tasks for team members and approve self-tasks.</p>`,
          text: `You're now manager of ${team.name} in ${projectName}.`,
        })
      } catch (_e) {
        /* non-blocking */
      }

      await createAuditLog(session, {
        action: "PROMOTE",
        module: "project",
        entityType: "ProjectTeam",
        entityId: teamId,
        changes: { newManagerId: member.employeeId, previousManagerId: team.managerId },
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[TEAM_MEMBER_PROMOTE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
