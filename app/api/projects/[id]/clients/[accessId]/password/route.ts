import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { resetProjectClientPassword } from "@/features/client-portal/server/client-admin.service"

// POST /api/projects/:id/clients/:accessId/password - issue a new password and
// email it. Body: { forcePasswordChange?: boolean }
export const POST = withProjectManager(async (req: NextRequest, { params }, session) => {
  const body = await req.json().catch(() => ({}))
  return respond(await resetProjectClientPassword(params.id, params.accessId, body, session))
})
