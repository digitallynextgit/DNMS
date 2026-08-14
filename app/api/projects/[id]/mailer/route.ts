import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import { getProjectMailer } from "@/features/project-mailer/server/project-mailer.service"

// GET /api/projects/:id/mailer - settings, templates, recipients, campaigns.
export const GET = withMailerAccess(async (_req, { params }) =>
  respond(await getProjectMailer(params.id)),
)
