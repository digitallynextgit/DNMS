import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth, withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/constants"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import type { Session } from "next-auth"

export const GET = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    const { searchParams } = req.nextUrl
    const status = searchParams.get("status") ?? undefined
    const mine = searchParams.get("mine") === "true"
    const { page, limit, skip, take } = resolvePagination(
      { page: searchParams.get("page"), limit: searchParams.get("limit") },
      20,
    )

    const where: Record<string, unknown> = { isArchived: false }
    if (status) where.status = status
    // Admins/PMs (project:write) can see all projects; everyone else is always
    // restricted to projects they own or are a team member of (the `mine`
    // filter can further narrow it for admins, but never widens it for others).
    const canViewAll = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
    if (!canViewAll || mine) {
      where.OR = [
        { ownerId: session.user.id },
        { teams: { some: { members: { some: { employeeId: session.user.id } } } } },
      ]
    }

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
          teams: {
            select: {
              id: true,
              name: true,
              members: {
                select: {
                  employee: {
                    select: { id: true, firstName: true, lastName: true, profilePhoto: true },
                  },
                },
              },
            },
          },
          _count: { select: { tasks: true, teams: true, resources: true } },
        },
      }),
      db.project.count({ where }),
    ])

    // Flatten members across all teams for the list-card avatar display
    const decorated = projects.map((p) => ({
      ...p,
      members: p.teams.flatMap((t) => t.members),
    }))

    return NextResponse.json({
      data: decorated,
      pagination: paginationMeta(total, page, limit),
    })
  } catch (error) {
    console.error("[PROJECTS_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const POST = withAuth(
  PERMISSIONS.PROJECT_WRITE,
  async (req: NextRequest, _ctx: unknown, session: Session) => {
    try {
      const body = await req.json()
      const { name, description, status, priority, startDate, budget, accountManagerId } = body

      // Validate Account Manager (formerly "owner") - falls back to creator if not supplied
      const ownerId: string = accountManagerId || session.user.id
      const accountManager = await db.employee.findUnique({
        where: { id: ownerId },
        select: { id: true, isActive: true },
      })
      if (!accountManager) {
        return NextResponse.json({ error: "Account Manager not found" }, { status: 422 })
      }
      if (!accountManager.isActive) {
        return NextResponse.json(
          { error: "Account Manager is not an active employee" },
          { status: 422 },
        )
      }

      // Auto-generate code in DN## format (DN01, DN02, …). Looks at max existing DN-prefixed code.
      const dnProjects = await db.project.findMany({
        where: { code: { startsWith: "DN" } },
        select: { code: true },
      })
      let maxNum = 0
      for (const p of dnProjects) {
        const m = p.code.match(/^DN(\d+)$/)
        if (m) {
          const n = parseInt(m[1], 10)
          if (n > maxNum) maxNum = n
        }
      }
      const nextNum = maxNum + 1
      const code = `DN${nextNum.toString().padStart(5, "0")}`

      const project = await db.project.create({
        data: {
          name,
          description,
          code,
          status: status ?? "PLANNING",
          priority: priority ?? "MEDIUM",
          ownerId,
          startDate: startDate ? new Date(startDate) : null,
          budget: budget ? parseFloat(budget) : null,
        },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      await createAuditLog(session, {
        action: "CREATE",
        module: "project",
        entityType: "Project",
        entityId: project.id,
        changes: { name, code: project.code, status: project.status },
      })

      return NextResponse.json({ data: project }, { status: 201 })
    } catch (error) {
      console.error("[PROJECTS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
