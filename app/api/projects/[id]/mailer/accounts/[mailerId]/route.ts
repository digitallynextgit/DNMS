import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { updateMailer, deleteMailer } from "@/features/project-mailer/server/project-mailer.service"

// PATCH  - edit. A blank password keeps the stored one.
// DELETE - refused while a campaign is still sending from this account.
export const PATCH = withProjectManager(async (req: NextRequest, { params }, session) =>
  respond(await updateMailer(params.id, params.mailerId, await req.json(), session)),
)

export const DELETE = withProjectManager(async (_req, { params }, session) =>
  respond(await deleteMailer(params.id, params.mailerId, session)),
)
