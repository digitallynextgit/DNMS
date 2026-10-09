import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectManager } from "@/features/projects/server/project-access"
import {
  SERVICE_OWNER_SELECT,
  ServiceOwnerError,
  setServiceOwner,
} from "@/features/projects/server/project-service-owners"
import { notifyOwnerAssigned } from "@/features/projects/server/owner-notifications"
import { createAuditLog } from "@/lib/audit"
import type { Session } from "next-auth"

// Body: { service: "SEO", employeeId: "<id>" | null } - null clears the owner. Returns every owner.
export const PUT = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const projectId = ctx.params.id
      const body = (await req.json()) as { service?: string; employeeId?: string | null }
      const service = typeof body.service === "string" ? body.service : ""
      const employeeId =
        typeof body.employeeId === "string" && body.employeeId ? body.employeeId : null

      await setServiceOwner(projectId, service, employeeId)

      await createAuditLog(session, {
        action: "UPDATE",
        module: "project",
        entityType: "ProjectServiceOwner",
        entityId: projectId,
        changes: { service, employeeId },
      })

      if (employeeId) {
        await notifyOwnerAssigned({
          projectId,
          employeeId,
          actorId: session.user.id,
          service,
        }).catch((e) => console.error("[SERVICE_OWNER_NOTIFY]", e))
      }

      const owners = await db.projectServiceOwner.findMany({
        where: { projectId },
        select: SERVICE_OWNER_SELECT,
      })
      return NextResponse.json({ data: owners })
    } catch (error) {
      if (error instanceof ServiceOwnerError) {
        return NextResponse.json({ error: error.message }, { status: 422 })
      }
      console.error("[PROJECT_SERVICE_OWNER_PUT]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
