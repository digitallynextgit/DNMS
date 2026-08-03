import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// GET /api/projects/performance/scope
//
// The option lists for the report builder: every project, team and person the
// caller is allowed to report on. Deliberately NOT filtered by the page's
// current selection - these are the things you can pick, so narrowing them by
// what is already picked would strand you with one option and no way back.
//
// Lazy: the progress page only calls this when the options dialog opens.
export const GET = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)

      // Same scope rule as the metrics route: managed teams, owned projects, own
      // tasks. Expressed per-model because each has its own path to the user.
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

      // Teams and people are constrained to the visible projects, so the pickers
      // can never offer something the report would then refuse to include.
      const teams = await db.projectTeam.findMany({
        where: { projectId: { in: projectIds } },
        select: {
          id: true,
          name: true,
          projectId: true,
          project: { select: { name: true, code: true } },
          _count: { select: { members: true } },
        },
        orderBy: [{ project: { name: "asc" } }, { name: "asc" }],
      })

      const members = await db.projectTeamMember.findMany({
        where: { team: { projectId: { in: projectIds } } },
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
          teams: teams.map((t) => ({
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
