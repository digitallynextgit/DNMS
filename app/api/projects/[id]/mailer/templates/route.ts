import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import { createTemplate } from "@/features/project-mailer/server/project-mailer.service"

export const POST = withMailerAccess(async (req: NextRequest, { params }, session) =>
  respond(await createTemplate(params.id, await req.json(), session), 201),
)
