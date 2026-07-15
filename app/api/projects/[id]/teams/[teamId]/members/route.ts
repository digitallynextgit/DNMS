import { NextRequest, NextResponse } from "next/server"
import { canManageProject, withProjectAccess } from "@/features/projects/server/project-access"
import { syncProjectFolderAccessAsync } from "@/features/projects/server/project-drive.service"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
import { addEmailJob } from "@/lib/queue"
import { createAuditLog } from "@/lib/audit"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import type { Session } from "next-auth"

// GET /api/projects/[id]/teams/[teamId]/members
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { teamId } = ctx.params
      const members = await db.projectTeamMember.findMany({
        where: { teamId },
        include: {
          employee: {
            select: {
              ...EMPLOYEE_SUMMARY_SELECT,
              designation: { select: { title: true } },
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      })
      return NextResponse.json({ data: members })
    } catch (error) {
      console.error("[TEAM_MEMBERS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// POST /api/projects/[id]/teams/[teamId]/members - add member (Admin or this team's Manager)
export const POST = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, teamId } = ctx.params
      const body = await req.json()
      const { employeeId } = body

      if (!employeeId)
        return NextResponse.json({ error: "employeeId is required" }, { status: 400 })

      const team = await db.projectTeam.findUnique({
        where: { id: teamId },
        include: { members: true },
      })
      if (!team || team.projectId !== projectId) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 })
      }

      // Authorisation: Admin OR current team's manager
      const isAdmin = await canManageProject(session, projectId)
      const isManagerOfThisTeam = team.managerId === session.user.id
      if (!isAdmin && !isManagerOfThisTeam) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      // Already on another team in the same project?
      const conflict = await db.projectTeamMember.findFirst({
        where: { projectId, employeeId },
        include: { team: { select: { name: true } } },
      })
      if (conflict) {
        return NextResponse.json(
          {
            error: `This employee is already on the "${conflict.team.name}" team in this project. Remove them from there first.`,
          },
          { status: 409 },
        )
      }

      // Verify employee exists
      const employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
      })
      if (!employee || !employee.isActive) {
        return NextResponse.json({ error: "Employee not found or inactive" }, { status: 404 })
      }

      // First member becomes manager automatically (decision FR-M-03)
      const willBeManager = team.members.length === 0

      const created = await db.$transaction(async (tx) => {
        const member = await tx.projectTeamMember.create({
          data: { teamId, projectId, employeeId },
          include: {
            employee: {
              select: EMPLOYEE_SUMMARY_SELECT,
            },
          },
        })

        if (willBeManager) {
          await tx.projectTeam.update({ where: { id: teamId }, data: { managerId: employeeId } })
        }

        return member
      })

      // Notify the added employee
      const projectName = (
        await db.project.findUnique({ where: { id: projectId }, select: { name: true } })
      )?.name
      try {
        await createNotification({
          employeeId,
          title: willBeManager ? "You're now a Team Manager" : "Added to a team",
          message: willBeManager
            ? `You've been added to "${team.name}" team in ${projectName} and made the team manager.`
            : `You've been added to the "${team.name}" team in ${projectName}.`,
          type: "info",
          link: `/projects/${projectId}`,
        })
        addEmailJob({
          to: employee.email,
          subject: willBeManager
            ? `Team Manager - ${team.name} (${projectName})`
            : `Added to ${team.name}`,
          html: `<p>Hi ${employee.firstName},</p>
            <p>You've been added to the <strong>${team.name}</strong> team in the <strong>${projectName}</strong> project${willBeManager ? " as the team manager" : ""}.</p>
            <p>Log in to DNMS for details.</p>`,
          text: `You've been added to ${team.name} in ${projectName}${willBeManager ? " as manager" : ""}.`,
        })
      } catch (_e) {
        /* non-blocking */
      }

      await createAuditLog(session, {
        action: willBeManager ? "ADD_AND_PROMOTE" : "ADD",
        module: "project",
        entityType: "ProjectTeamMember",
        entityId: created.id,
        changes: { teamId, employeeId, autoManager: willBeManager },
      })

      // Give the new member access to the project's Drive folder (fire-and-forget).
      syncProjectFolderAccessAsync(ctx.params.id)

      return NextResponse.json({ data: created, isManager: willBeManager }, { status: 201 })
    } catch (error) {
      console.error("[TEAM_MEMBERS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
