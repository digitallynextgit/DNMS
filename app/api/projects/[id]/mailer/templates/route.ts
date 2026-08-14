import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { createTemplate } from "@/features/project-mailer/server/project-mailer.service"

export const POST = withProjectManager(async (req: NextRequest, { params }, session) =>
  respond(await createTemplate(params.id, await req.json(), session), 201),
)
