import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import { deleteMailerImage } from "@/features/project-mailer/server/project-mailer.service"

// Refused (409) while a sent campaign still references the image.
export const DELETE = withMailerAccess(async (_req, { params }, session) =>
  respond(await deleteMailerImage(params.id, params.assetId, session)),
)
