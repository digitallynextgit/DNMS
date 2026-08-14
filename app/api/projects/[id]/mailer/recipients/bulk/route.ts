import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { addRecipientsBulk } from "@/features/project-mailer/server/project-mailer.service"

// POST /api/projects/:id/mailer/recipients/bulk - paste-import a list.
export const POST = withProjectManager(async (req: NextRequest, { params }) =>
  respond(await addRecipientsBulk(params.id, await req.json()), 201),
)
