import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import {
  updateTemplate,
  deleteTemplate,
} from "@/features/project-mailer/server/project-mailer.service"

export const PATCH = withProjectManager(async (req: NextRequest, { params }, session) =>
  respond(await updateTemplate(params.id, params.templateId, await req.json(), session)),
)

export const DELETE = withProjectManager(async (_req, { params }, session) =>
  respond(await deleteTemplate(params.id, params.templateId, session)),
)
