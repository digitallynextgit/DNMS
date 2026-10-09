import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { sortProjectTeams } from "@/features/projects/lib/project-teams"
import type { Session } from "next-auth"

// Not filtered by the current selection, or picking one option would strand you with no way back.
export const GET = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)

      // Same scope rule as the metrics route, expressed per model.
      const projectWhere = isAdmin
        ? {}
        : {
            OR: [
              { ownerId: session.user.id },
              { teams: { some: { managerId: session.user.id } } },
              { tasks: { some: { assigneeId: session.user.id } } },
            ],
          }

      const projects = await db.project.findMany({
        where: projectWhere,
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      })
      const projectIds = projects.map((p) => p.id)

      // Constrained to the visible projects, so the pickers never offer what the report would refuse.
      const teams = await db.projectTeam.findMany({
        where: { projectId: { in: projectIds } },
        select: {
          id: true,
          name: true,
          projectId: true,
          project: { select: { name: true, code: true } },
          _count: { select: { members: true } },
        },
      })

      const members = await db.projectTeamMember.findMany({
        // The silent admin_ watch account is never offered as a person.
        where: { team: { projectId: { in: projectIds } }, employee: VISIBLE_EMPLOYEE_FILTER },
        select: {
          employee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
        },
        distinct: ["employeeId"],
      })

      const people = members
        .map((m) => m.employee)
        .filter((e): e is NonNullable<typeof e> => !!e)
        .map((e) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`.trim(),
          profilePhoto: e.profilePhoto,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

      return NextResponse.json({
        data: {
          projects,
          // By project, and each project's teams in catalogue order (the sort is stable).
          teams: sortProjectTeams(teams)
            .sort(
              (a, b) =>
                a.project.name.localeCompare(b.project.name) ||
                a.projectId.localeCompare(b.projectId),
            )
            .map((t) => ({
              id: t.id,
              name: t.name,
              projectId: t.projectId,
              projectName: t.project?.name ?? "",
              memberCount: t._count.members,
            })),
          people,
        },
      })
    } catch (error) {
      console.error("[projects/performance/scope] GET error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
