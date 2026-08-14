import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { createMailer } from "@/features/project-mailer/server/project-mailer.service"

// POST /api/projects/:id/mailer/accounts - add a sending account.
export const POST = withProjectManager(async (req: NextRequest, { params }, session) =>
  respond(await createMailer(params.id, await req.json(), session), 201),
)
