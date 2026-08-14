import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import { addRecipientsBulk } from "@/features/project-mailer/server/project-mailer.service"

// POST /api/projects/:id/mailer/recipients/bulk - paste-import a list.
export const POST = withMailerAccess(async (req: NextRequest, { params }) =>
  respond(await addRecipientsBulk(params.id, await req.json()), 201),
)
