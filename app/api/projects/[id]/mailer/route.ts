import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { getProjectMailer } from "@/features/project-mailer/server/project-mailer.service"

// GET /api/projects/:id/mailer - settings, templates, recipients, campaigns.
export const GET = withProjectManager(async (_req, { params }) =>
  respond(await getProjectMailer(params.id)),
)
