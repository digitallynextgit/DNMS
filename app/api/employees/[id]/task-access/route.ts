import { NextRequest } from "next/server"
import { withAuth } from "@/server/api-handler"
import { ok, fail } from "@/lib/api-response"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/constants"
import { getTaskAccess, setTaskAccess } from "@/features/employees/server/task-access.service"
import type { Session } from "next-auth"

// Override of the 15-minute task edit window. employee:write, since it lets someone rewrite their own history.

export const GET = withAuth(
  PERMISSIONS.EMPLOYEE_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) =>
    ok(await getTaskAccess(ctx.params.id)),
)

export const PATCH = withAuth(
  PERMISSIONS.EMPLOYEE_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null
    if (typeof body?.enabled !== "boolean") {
      return fail("BAD_REQUEST", "enabled must be true or false.", 400)
    }

    const result = await setTaskAccess(ctx.params.id, body.enabled, session.user.id)

    await createAuditLog(session, {
      action: "UPDATE",
      module: "employee",
      entityType: "Employee",
      entityId: ctx.params.id,
      changes: { canEditPastTasks: body.enabled } as object,
    })

    return ok(result)
  },
)
