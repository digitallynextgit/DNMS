import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import { deleteMailerImage } from "@/features/project-mailer/server/project-mailer.service"

// DELETE /api/projects/:id/mailer/images/:assetId
// Removes the B2 object. Refused (409) when a sent campaign still references it.
export const DELETE = withMailerAccess(async (_req, { params }, session) =>
  respond(await deleteMailerImage(params.id, params.assetId, session)),
)
