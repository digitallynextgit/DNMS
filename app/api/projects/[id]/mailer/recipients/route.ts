import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import { addRecipient } from "@/features/project-mailer/server/project-mailer.service"

export const POST = withMailerAccess(async (req: NextRequest, { params }) =>
  respond(await addRecipient(params.id, await req.json()), 201),
)
