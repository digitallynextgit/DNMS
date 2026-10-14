import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import {
  SERVICE_OWNER_SELECT,
  ServiceOwnerError,
  assertMayChangeServiceOwners,
  setServiceOwners,
  type ServiceOwnerChange,
} from "@/features/projects/server/project-service-owners"
import { notifyOwnerAssigned } from "@/features/projects/server/owner-notifications"
import { createAuditLog, isAdmin_Session } from "@/lib/audit"
import type { Session } from "next-auth"

const personOrNull = (v: unknown) => (typeof v === "string" && v ? v : null)

// Body: { service: "SEO", employeeId?: "<id>" | null, secondaryEmployeeId?: "<id>" | null }. A key
// left out stays as it is; null clears. An Account Manager or admin sets either; the service's owner
// may pick their own secondary. Returns every owner.
export const PUT = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const projectId = ctx.params.id!
      const body = (await req.json()) as {
        service?: string
        employeeId?: string | null
        secondaryEmployeeId?: string | null
      }
      const service = typeof body.service === "string" ? body.service : ""
      const change: ServiceOwnerChange = {}
      if ("employeeId" in body) change.primary = personOrNull(body.employeeId)
      if ("secondaryEmployeeId" in body) change.secondary = personOrNull(body.secondaryEmployeeId)
      if (change.primary === undefined && change.secondary === undefined) {
        return NextResponse.json(
          { error: "Send employeeId and/or secondaryEmployeeId" },
          { status: 422 },
        )
      }

      await assertMayChangeServiceOwners(session, projectId, service, change)
      const assigned = await setServiceOwners(projectId, service, change)

      await createAuditLog(session, {
        action: "UPDATE",
        module: "project",
        entityType: "ProjectServiceOwner",
        entityId: projectId,
        changes: { service, ...change },
      })

      for (const a of assigned) {
        await notifyOwnerAssigned({
          projectId,
          employeeId: a.employeeId,
          actorId: session.user.id,
          silentActor: isAdmin_Session(session),
          service,
          secondary: a.secondary,
        }).catch((e) => console.error("[SERVICE_OWNER_NOTIFY]", e))
      }

      const owners = await db.projectServiceOwner.findMany({
        where: { projectId },
        select: SERVICE_OWNER_SELECT,
      })
      return NextResponse.json({ data: owners })
    } catch (error) {
      if (error instanceof ServiceOwnerError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      console.error("[PROJECT_SERVICE_OWNER_PUT]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
