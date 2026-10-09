import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import { sortProjectTeams, TEAMS_ARE_FIXED } from "@/features/projects/lib/project-teams"
import type { Session } from "next-auth"

export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId } = ctx.params

      const teams = await db.projectTeam.findMany({
        where: { projectId },
        include: {
          manager: { select: EMPLOYEE_SUMMARY_SELECT },
          // The member cards show designations, which the shared summary select lacks.
          members: {
            include: {
              employee: {
                select: { ...EMPLOYEE_SUMMARY_SELECT, designation: { select: { title: true } } },
              },
            },
          },
          _count: { select: { tasks: true } },
        },
      })

      return NextResponse.json({ data: sortProjectTeams(teams) })
    } catch (error) {
      console.error("[PROJECT_TEAMS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// POST - refused. Every project has the same fixed teams (features/projects/lib/project-teams.ts),
// made with the project; nobody, admin included, adds one. Staff a team instead.
export function POST() {
  return NextResponse.json({ error: TEAMS_ARE_FIXED }, { status: 405, headers: { Allow: "GET" } })
}
