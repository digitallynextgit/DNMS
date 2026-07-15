import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { withProjectManager, withProjectAccess } from "@/features/projects/server/project-access"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const project = await db.project.findUnique({
        where: { id: ctx.params.id },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
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

      // Provide flat members list for list-card compatibility
      const decorated = {
        ...project,
        members: project.teams.flatMap((t) => t.members),
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
      } = body

      // Validate new Account Manager if provided
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
          ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
          ...(budget !== undefined && { budget: budget ? parseFloat(budget) : null }),
          ...(isArchived !== undefined && { isArchived }),
          ...(accountManagerId !== undefined && { ownerId: accountManagerId }),
        },
      })

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
          startDate,
          budget,
          accountManagerId,
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
