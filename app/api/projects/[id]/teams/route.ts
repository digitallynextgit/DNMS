import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth, withSession } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import type { Session } from "next-auth"

// GET /api/projects/[id]/teams - list teams in a project
export const GET = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId } = ctx.params

      const teams = await db.projectTeam.findMany({
        where: { projectId },
        include: {
          manager: {
            select: EMPLOYEE_SUMMARY_SELECT,
          },
          members: {
            include: {
              employee: {
                select: EMPLOYEE_SUMMARY_SELECT,
              },
            },
          },
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: "asc" },
      })

      return NextResponse.json({ data: teams })
    } catch (error) {
      console.error("[PROJECT_TEAMS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// POST /api/projects/[id]/teams - create a new team (Admin only)
export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId } = ctx.params
      const body = await req.json()
      const { name, description } = body

      if (!name || typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Team name is required" }, { status: 400 })
      }

      // Verify project exists
      const project = await db.project.findUnique({ where: { id: projectId } })
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

      // Check duplicate
      const existing = await db.projectTeam.findFirst({
        where: { projectId, name: name.trim() },
      })
      if (existing) {
        return NextResponse.json(
          { error: `A team named "${name.trim()}" already exists in this project` },
          { status: 409 },
        )
      }

      const team = await db.projectTeam.create({
        data: {
          projectId,
          name: name.trim(),
          description: description?.trim() || null,
        },
        include: {
          manager: { select: { id: true, firstName: true, lastName: true } },
          members: true,
        },
      })

      await createAuditLog(session, {
        action: "CREATE",
        module: "project",
        entityType: "ProjectTeam",
        entityId: team.id,
        changes: { projectId, name: team.name, description: team.description },
      })

      return NextResponse.json({ data: team }, { status: 201 })
    } catch (error) {
      console.error("[PROJECT_TEAMS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
