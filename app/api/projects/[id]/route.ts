import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import {
  resolveProjectId,
  withProjectManager,
  withProjectAccess,
} from "@/features/projects/server/project-access"
import {
  addToAccountManagerTeam,
  syncAccountManagerTeam,
} from "@/features/projects/server/project-teams"
import {
  LeadChangeError,
  leadInputFrom,
  planLeadChange,
} from "@/features/projects/server/project-leads.service"
import { notifyLeadAssigned } from "@/features/projects/server/owner-notifications"
import { PROJECT_LEADS_SELECT } from "@/features/projects/lib/project-leads"
import { syncProjectFolderAccessAsync } from "@/features/projects/server/project-drive.service"
import { shortNameTaken } from "@/features/projects/server/project-create.service"
import {
  SERVICE_OWNER_SELECT,
  pruneServiceOwners,
} from "@/features/projects/server/project-service-owners"
import { ensureServiceCalendars } from "@/features/projects/server/service-calendars"
import {
  normaliseServices,
  normaliseShortName,
  shortNameProblem,
} from "@/features/projects/lib/project-services"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS, PROJECT_STAGE_LABELS } from "@/lib/constants"
import type { Session } from "next-auth"

const PERSON = { id: true, firstName: true, lastName: true, profilePhoto: true } as const

export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const project = await db.project.findUnique({
        where: { id: ctx.params.id },
        include: {
          owner: { select: PERSON },
          secondaryAccountManager: { select: PERSON },
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
          serviceOwners: { select: SERVICE_OWNER_SELECT },
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

// PATCH /api/projects/[id] - update a project (name, status, priority, phase, client, dates, budget, archive)
// and its Account Managers: accountManagerId (alias ownerId; admins only) and secondaryAccountManagerId
// (the primary or an admin; null clears).
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
        clientId,
        stage,
      } = body
      const current = await db.project.findUnique({
        where: { id: ctx.params.id },
        select: PROJECT_LEADS_SELECT,
      })
      if (!current) return NextResponse.json({ error: "Project not found" }, { status: 404 })
      // Its Account Managers (lib/project-leads.ts): checked before anything else is touched.
      let leads
      try {
        leads = await planLeadChange(session, current, leadInputFrom(body))
      } catch (e) {
        if (e instanceof LeadChangeError) {
          return NextResponse.json({ error: e.message }, { status: e.status })
        }
        throw e
      }

      // Lifecycle "Phase": a known stage, or null/"" to clear it.
      if (stage && !(stage in PROJECT_STAGE_LABELS)) {
        return NextResponse.json({ error: "Unknown project phase" }, { status: 422 })
      }

      // `null` clears the client; a string must name one in this tenant.
      if (clientId) {
        const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } })
        if (!client) return NextResponse.json({ error: "Client not found" }, { status: 422 })
      }

      // `undefined` leaves them alone; null/"" clears the short name.
      const shortName =
        body.shortName === undefined ? undefined : normaliseShortName(body.shortName)
      if (shortName) {
        const problem = shortNameProblem(shortName)
        if (problem) return NextResponse.json({ error: problem }, { status: 422 })
        if (await shortNameTaken(shortName, ctx.params.id)) {
          return NextResponse.json(
            { error: `The short name "${shortName}" is already used by another project.` },
            { status: 409 },
          )
        }
      }
      const services = body.services === undefined ? undefined : normaliseServices(body.services)

      const project = await db.project.update({
        where: { id: ctx.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(shortName !== undefined && { shortName }),
          ...(services !== undefined && { services }),
          ...(description !== undefined && { description }),
          ...(status !== undefined && { status }),
          ...(priority !== undefined && { priority }),
          ...(stage !== undefined && {
            stage: (stage || null) as "LAUNCH" | "GROWTH" | "REBRANDING" | "DECLINE" | null,
          }),
          ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
          ...(budget !== undefined && { budget: budget ? parseFloat(budget) : null }),
          ...(isArchived !== undefined && { isArchived }),
          ...leads.data,
          ...(clientId !== undefined && { clientId: clientId || null }),
        },
      })

      if (services !== undefined) {
        await pruneServiceOwners(project.id, services)
        // Saved either way; a calendar that fails can be made from the services popup.
        await ensureServiceCalendars(project.id, session.user.id).catch((e) =>
          console.error("[SERVICE_CALENDARS]", e),
        )
      }

      if (leads.data.ownerId) await syncAccountManagerTeam(project.id, leads.data.ownerId)
      if (leads.data.secondaryAccountManagerId) {
        await addToAccountManagerTeam(project.id, leads.data.secondaryAccountManagerId)
      }
      // Both Account Managers open the project's Drive folder.
      if (Object.keys(leads.data).length > 0) syncProjectFolderAccessAsync(project.id)

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
          shortName,
          services,
          description,
          status,
          priority,
          stage,
          startDate,
          budget,
          ...leads.data,
          clientId,
          isArchived,
        } as object,
      })
      await notifyLeadAssigned({
        projectId: project.id,
        assigned: leads.assigned,
        actorId: session.user.id,
      }).catch((e) => console.error("[PROJECT_LEADS_NOTIFY]", e))

      return NextResponse.json({ data: project })
    } catch (error) {
      // The only unique field a PATCH can change is the short name (a save racing another).
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "That short name is already used by another project." },
          { status: 409 },
        )
      }
      console.error("[PROJECT_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withAuth(
  PERMISSIONS.PROJECT_DELETE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      // Slug-tolerant like the project's other routes (withAuth doesn't swap the slug for the id).
      const projectId = await resolveProjectId(ctx.params.id!)
      if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })
      await db.project.delete({ where: { id: projectId } })
      return NextResponse.json({ message: "Project deleted" })
    } catch (error) {
      console.error("[PROJECT_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
