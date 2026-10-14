import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth, withSession } from "@/server/api-handler"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS, PROJECT_STAGE_LABELS } from "@/lib/constants"
import { listProjects } from "@/features/projects/server/projects.queries"
import {
  createProject,
  ShortNameTakenError,
} from "@/features/projects/server/project-create.service"
import {
  LeadChangeError,
  leadInputFrom,
  planLeadChange,
} from "@/features/projects/server/project-leads.service"
import { notifyLeadAssigned } from "@/features/projects/server/owner-notifications"
import {
  normaliseServices,
  normaliseShortName,
  shortNameProblem,
} from "@/features/projects/lib/project-services"
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
      const { name, description, status, priority, startDate, budget, clientId } = body
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

      const shortName = normaliseShortName(body.shortName)
      const shortNameError = shortName && shortNameProblem(shortName)
      if (shortNameError) return NextResponse.json({ error: shortNameError }, { status: 422 })

      // The Account Managers (lib/project-leads.ts); the primary defaults to the creator.
      const leadInput = leadInputFrom(body)
      leadInput.ACCOUNT_MANAGER ??= session.user.id
      let leads
      try {
        leads = await planLeadChange(session, null, leadInput)
      } catch (e) {
        if (e instanceof LeadChangeError) {
          return NextResponse.json({ error: e.message }, { status: e.status })
        }
        throw e
      }

      let created
      try {
        created = await createProject(
          {
            name,
            description,
            status: status ?? "PLANNING",
            priority: priority ?? "MEDIUM",
            stage: stage as "LAUNCH" | "GROWTH" | "REBRANDING" | "DECLINE" | null,
            ownerId: leads.data.ownerId ?? session.user.id,
            secondaryAccountManagerId: leads.data.secondaryAccountManagerId ?? null,
            clientId: clientId || null,
            startDate: startDate ? new Date(startDate) : null,
            budget: budget ? parseFloat(budget) : null,
            shortName,
            services: normaliseServices(body.services),
          },
          session.user.id,
        )
      } catch (e) {
        if (e instanceof ShortNameTakenError) {
          return NextResponse.json({ error: e.message }, { status: 409 })
        }
        throw e
      }
      const { project, teams } = created

      await createAuditLog(session, {
        action: "CREATE",
        module: "project",
        entityType: "Project",
        entityId: project.id,
        changes: {
          name,
          code: project.code,
          shortName: project.shortName,
          services: project.services,
          status: project.status,
          clientId: clientId || null,
          ...leads.data,
          teams: teams.map((t) => t.name),
        },
      })
      await notifyLeadAssigned({
        projectId: project.id,
        assigned: leads.assigned,
        actorId: session.user.id,
      }).catch((e) => console.error("[PROJECT_LEADS_NOTIFY]", e))

      return NextResponse.json({ data: project }, { status: 201 })
    } catch (error) {
      console.error("[PROJECTS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
