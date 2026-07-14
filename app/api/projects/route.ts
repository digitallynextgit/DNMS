import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth, withSession } from "@/server/api-handler"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/constants"
import { listProjects } from "@/features/projects/server/projects.queries"
import type { Session } from "next-auth"

export const GET = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    const { searchParams } = req.nextUrl
    return NextResponse.json(
      await listProjects(
        {
          status: searchParams.get("status") ?? undefined,
          mine: searchParams.get("mine") === "true",
          page: searchParams.get("page"),
          limit: searchParams.get("limit"),
        },
        session,
      ),
    )
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

      // Auto-generate code in DN##### format (DN00001, DN00002, …). Codes are
      // fixed-width and zero-padded (this endpoint is the only generator), so the
      // lexicographically highest DN code IS the numerically highest one - let the
      // DB find it instead of loading every project code into JS.
      const lastDn = await db.project.findFirst({
        where: { code: { startsWith: "DN" } },
        select: { code: true },
        orderBy: { code: "desc" },
      })
      const lastMatch = lastDn?.code.match(/^DN(\d+)$/)
      const maxNum = lastMatch ? parseInt(lastMatch[1] ?? "0", 10) : 0
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
