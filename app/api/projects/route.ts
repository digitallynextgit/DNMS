import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth, withSession } from "@/server/api-handler"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS, PROJECT_STAGE_LABELS } from "@/lib/constants"
import { listProjects } from "@/features/projects/server/projects.queries"
import { generateProjectSlug } from "@/features/projects/server/project-slug"
import { ensureProjectTeams } from "@/features/projects/server/project-teams"
import { syncProjectFolderAccessAsync } from "@/features/projects/server/project-drive.service"
import type { Session } from "next-auth"

export const GET = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    const { searchParams } = req.nextUrl
    return NextResponse.json(
      await listProjects(
        {
          status: searchParams.get("status") ?? undefined,
          mine: searchParams.get("mine") === "true",
          clientId: searchParams.get("clientId") ?? undefined,
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
      const { name, description, status, priority, startDate, budget, accountManagerId, clientId } =
        body
      // Optional lifecycle "Phase"; anything but a known stage is refused.
      const stage: string | null = body.stage || null
      if (stage && !(stage in PROJECT_STAGE_LABELS)) {
        return NextResponse.json({ error: "Unknown project phase" }, { status: 422 })
      }

      // Looked up through the tenant guard, so another company's id reads as "not found".
      if (clientId) {
        const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } })
        if (!client) return NextResponse.json({ error: "Client not found" }, { status: 422 })
      }

      // The Account Manager defaults to the creator.
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

      // Codes are fixed-width DN#####, so the highest string is the highest number - let the DB find it.
      // Retries on the unique-violation race when two creates compute the same code.
      let project
      for (let attempt = 0; ; attempt++) {
        const lastDn = await db.project.findFirst({
          where: { code: { startsWith: "DN" } },
          select: { code: true },
          orderBy: { code: "desc" },
        })
        const lastMatch = lastDn?.code.match(/^DN(\d+)$/)
        const maxNum = lastMatch ? parseInt(lastMatch[1] ?? "0", 10) : 0
        const code = `DN${(maxNum + 1 + attempt).toString().padStart(5, "0")}`

        try {
          project = await db.project.create({
            data: {
              name,
              description,
              code,
              slug: await generateProjectSlug(name, code),
              status: status ?? "PLANNING",
              priority: priority ?? "MEDIUM",
              stage: stage as "LAUNCH" | "GROWTH" | "REBRANDING" | "DECLINE" | null,
              ownerId,
              clientId: clientId || null,
              startDate: startDate ? new Date(startDate) : null,
              budget: budget ? parseFloat(budget) : null,
            },
            include: {
              owner: { select: { id: true, firstName: true, lastName: true } },
            },
          })
          break
        } catch (e) {
          // P2002 on `code`: another create took this number; recompute (give up after 5).
          if ((e as { code?: string }).code === "P2002" && attempt < 5) continue
          throw e
        }
      }

      // Every project gets the whole team catalogue from day one, its owner on AM (see ensureProjectTeams).
      const teams = await ensureProjectTeams(project.id)
      // Share the Drive folder with the owner and team managers straight away.
      syncProjectFolderAccessAsync(project.id)

      await createAuditLog(session, {
        action: "CREATE",
        module: "project",
        entityType: "Project",
        entityId: project.id,
        changes: {
          name,
          code: project.code,
          status: project.status,
          clientId: clientId || null,
          teams: teams.map((t) => t.name),
        },
      })

      return NextResponse.json({ data: project }, { status: 201 })
    } catch (error) {
      console.error("[PROJECTS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
