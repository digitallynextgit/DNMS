import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { withProjectManager, withProjectAccess } from "@/features/projects/server/project-access"
import { syncAccountManagerTeam } from "@/features/projects/server/project-teams"
import { syncProjectFolderAccessAsync } from "@/features/projects/server/project-drive.service"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS, PROJECT_STAGE_LABELS } from "@/lib/constants"
import type { Session } from "next-auth"

export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const project = await db.project.findUnique({
        where: { id: ctx.params.id },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
          client: { select: { id: true, name: true, slug: true, code: true } },
          teams: {
            include: {
              manager: {
                select: { id: true, firstName: true, lastName: true, profilePhoto: true },
              },
              members: {
                include: {
                  employee: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      profilePhoto: true,
                      designation: { select: { title: true } },
                    },
                  },
                },
              },
              _count: { select: { tasks: true } },
            },
          },
          _count: { select: { tasks: true, teams: true, resources: true } },
        },
      })

      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

      // Once per person: someone can be on several of the project's teams.
      const decorated = {
        ...project,
        members: [
          ...new Map(
            project.teams.flatMap((t) => t.members).map((m) => [m.employeeId, m]),
          ).values(),
        ],
      }

      return NextResponse.json({ data: decorated })
    } catch (error) {
      console.error("[PROJECT_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const PATCH = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json()
      const {
        name,
        description,
        status,
        priority,
        startDate,
        budget,
        isArchived,
        accountManagerId,
        clientId,
        stage,
      } = body

      // Lifecycle "Phase": a known stage, or null/"" to clear it.
      if (stage && !(stage in PROJECT_STAGE_LABELS)) {
        return NextResponse.json({ error: "Unknown project phase" }, { status: 422 })
      }

      // `null` clears the client; a string must name one in this tenant.
      if (clientId) {
        const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } })
        if (!client) return NextResponse.json({ error: "Client not found" }, { status: 422 })
      }

      if (accountManagerId) {
        const emp = await db.employee.findUnique({
          where: { id: accountManagerId },
          select: { id: true, isActive: true },
        })
        if (!emp) return NextResponse.json({ error: "Account Manager not found" }, { status: 422 })
        if (!emp.isActive)
          return NextResponse.json(
            { error: "Account Manager is not an active employee" },
            { status: 422 },
          )
      }

      const project = await db.project.update({
        where: { id: ctx.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(status !== undefined && { status }),
          ...(priority !== undefined && { priority }),
          ...(stage !== undefined && {
            stage: (stage || null) as "LAUNCH" | "GROWTH" | "REBRANDING" | "DECLINE" | null,
          }),
          ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
          ...(budget !== undefined && { budget: budget ? parseFloat(budget) : null }),
          ...(isArchived !== undefined && { isArchived }),
          ...(accountManagerId !== undefined && { ownerId: accountManagerId }),
          ...(clientId !== undefined && { clientId: clientId || null }),
        },
      })

      if (accountManagerId) {
        await syncAccountManagerTeam(project.id, accountManagerId)
        syncProjectFolderAccessAsync(project.id)
      }

      // Filing under a client moves this project's unaffiliated portal logins to it (so they show on its
      // Contacts tab); logins at another company are left alone.
      if (clientId) {
        await db.clientUser.updateMany({
          where: { clientId: null, access: { some: { projectId: ctx.params.id } } },
          data: { clientId },
        })
      }

      await createAuditLog(session, {
        action: "UPDATE",
        module: "project",
        entityType: "Project",
        entityId: ctx.params.id,
        changes: {
          name,
          description,
          status,
          priority,
          stage,
          startDate,
          budget,
          accountManagerId,
          clientId,
          isArchived,
        } as object,
      })

      return NextResponse.json({ data: project })
    } catch (error) {
      console.error("[PROJECT_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withAuth(
  PERMISSIONS.PROJECT_DELETE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      await db.project.delete({ where: { id: ctx.params.id } })
      return NextResponse.json({ message: "Project deleted" })
    } catch (error) {
      console.error("[PROJECT_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
