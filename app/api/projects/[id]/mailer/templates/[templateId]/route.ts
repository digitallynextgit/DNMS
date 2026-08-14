import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import {
  updateTemplate,
  deleteTemplate,
} from "@/features/project-mailer/server/project-mailer.service"

export const PATCH = withMailerAccess(async (req: NextRequest, { params }, session) =>
  respond(await updateTemplate(params.id, params.templateId, await req.json(), session)),
)

export const DELETE = withMailerAccess(async (_req, { params }, session) =>
  respond(await deleteTemplate(params.id, params.templateId, session)),
)
