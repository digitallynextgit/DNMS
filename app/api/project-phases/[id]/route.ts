import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// PATCH /api/project-phases/[id]
export const PATCH = withAuth(
  PERMISSIONS.PROJECT_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params
      const body = await req.json()
      const { name, description, displayOrder, isActive } = body

      const existing = await db.projectPhase.findUnique({ where: { id } })
      if (!existing) return NextResponse.json({ error: "Phase not found" }, { status: 404 })

      const data: Record<string, unknown> = {}

      if (name !== undefined) {
        if (!name.trim())
          return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
        const dupe = await db.projectPhase.findFirst({
          where: { name: name.trim(), parentId: existing.parentId, NOT: { id } },
        })
        if (dupe)
          return NextResponse.json(
            { error: "Another phase at this level already has that name" },
            { status: 409 },
          )
        data.name = name.trim()
      }
      if (description !== undefined) data.description = description?.trim() || null
      if (displayOrder !== undefined) data.displayOrder = Number(displayOrder)
      if (isActive !== undefined) data.isActive = !!isActive

      const phase = await db.projectPhase.update({ where: { id }, data })

      await createAuditLog(session, {
        action: "UPDATE",
        module: "project",
        entityType: "ProjectPhase",
        entityId: id,
        changes: data as object,
      })

      return NextResponse.json({ data: phase })
    } catch (error) {
      console.error("[PROJECT_PHASE_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// DELETE /api/project-phases/[id]
export const DELETE = withAuth(
  PERMISSIONS.PROJECT_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params
      const phase = await db.projectPhase.findUnique({
        where: { id },
        include: { children: { select: { id: true } } },
      })
      if (!phase) return NextResponse.json({ error: "Phase not found" }, { status: 404 })

      const childIds = phase.children.map((c) => c.id)

      // Count projects displaced by this deletion (parent + all children)
      const idsToDelete = [id, ...childIds]
      const inUseCount = await db.project.count({ where: { currentPhaseId: { in: idsToDelete } } })

      // Delete children first (FK constraint), then parent
      if (childIds.length > 0) {
        await db.projectPhase.deleteMany({ where: { id: { in: childIds } } })
      }
      await db.projectPhase.delete({ where: { id } })

      await createAuditLog(session, {
        action: "DELETE",
        module: "project",
        entityType: "ProjectPhase",
        entityId: id,
        changes: {
          name: phase.name,
          deletedSubPhases: childIds.length,
          displacedFromProjects: inUseCount,
        },
      })

      return NextResponse.json({
        success: true,
        deletedSubPhases: childIds.length,
        displacedFromProjects: inUseCount,
      })
    } catch (error) {
      console.error("[PROJECT_PHASE_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
