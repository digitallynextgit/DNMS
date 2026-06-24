import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth, withSession } from "@/server/api-handler"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

const DEFAULT_PHASES = [
  {
    name: "Initiation",
    description: "Define project goals, identify stakeholders, and assess feasibility.",
    displayOrder: 1,
  },
  {
    name: "Planning",
    description: "Detailed scheduling, resource allocation, risk analysis, and budgeting.",
    displayOrder: 2,
  },
  {
    name: "Execution",
    description: "Active delivery of project work and team coordination.",
    displayOrder: 3,
  },
  {
    name: "Monitoring & Controlling",
    description: "Track progress, manage risks, handle change requests, and ensure quality.",
    displayOrder: 4,
  },
  {
    name: "Closing",
    description: "Final delivery, client sign-off, retrospective, and project archival.",
    displayOrder: 5,
  },
]

// GET /api/project-phases - anyone signed in can read
// Auto-initialises the 5 default PMI phases the first time (when the table is empty).
export const GET = withSession(async (_req: NextRequest, _ctx: unknown, _session: Session) => {
  try {
    const count = await db.projectPhase.count()
    if (count === 0) {
      for (const p of DEFAULT_PHASES) {
        await db.projectPhase.create({ data: p })
      }
    }

    const phases = await db.projectPhase.findMany({
      where: { parentId: null },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: {
        children: {
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        },
      },
    })
    return NextResponse.json({ data: phases })
  } catch (error) {
    console.error("[PROJECT_PHASES_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

// POST /api/project-phases - admin only
export const POST = withAuth(
  PERMISSIONS.PROJECT_WRITE,
  async (req: NextRequest, _ctx: unknown, session: Session) => {
    try {
      const body = await req.json()
      const { name, description, displayOrder, parentId } = body

      if (!name || !name.trim()) {
        return NextResponse.json({ error: "Phase name is required" }, { status: 400 })
      }

      // If parentId provided, validate parent exists and is top-level (enforce max 2 levels)
      if (parentId) {
        const parent = await db.projectPhase.findUnique({ where: { id: parentId } })
        if (!parent) return NextResponse.json({ error: "Parent phase not found" }, { status: 400 })
        if (parent.parentId)
          return NextResponse.json(
            { error: "Sub-phases cannot have sub-phases (max 2 levels)" },
            { status: 400 },
          )
      }

      // Name uniqueness within the same level
      const dupe = await db.projectPhase.findFirst({
        where: { name: name.trim(), parentId: parentId ?? null },
      })
      if (dupe) {
        const scope = parentId ? "under this phase" : "at the top level"
        return NextResponse.json(
          { error: `A phase named "${name.trim()}" already exists ${scope}` },
          { status: 409 },
        )
      }

      let order = Number(displayOrder)
      if (isNaN(order)) {
        const last = await db.projectPhase.findFirst({
          where: { parentId: parentId ?? null },
          orderBy: { displayOrder: "desc" },
        })
        order = (last?.displayOrder ?? 0) + 1
      }

      const phase = await db.projectPhase.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          displayOrder: order,
          parentId: parentId ?? null,
        },
      })

      await createAuditLog(session, {
        action: "CREATE",
        module: "project",
        entityType: "ProjectPhase",
        entityId: phase.id,
        changes: {
          name: phase.name,
          description: phase.description,
          displayOrder: phase.displayOrder,
          parentId: phase.parentId,
        },
      })

      return NextResponse.json({ data: phase }, { status: 201 })
    } catch (error) {
      console.error("[PROJECT_PHASES_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
