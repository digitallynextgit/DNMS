import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { addRecipient } from "@/features/project-mailer/server/project-mailer.service"

export const POST = withProjectManager(async (req: NextRequest, { params }) =>
  respond(await addRecipient(params.id, await req.json()), 201),
)
