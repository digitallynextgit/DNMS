import { withSession, respond } from "@/server/api-handler"
import { deletePhoto } from "@/features/noticeboard/server/noticeboard.service"

// withSession, not withAuth(GALLERY_WRITE): every employee can upload now, so
// every employee must be able to take their OWN upload back down. deletePhoto()
// enforces that - anyone else's still needs gallery:write.
export const DELETE = withSession(async (_req, ctx, session) =>
  respond(await deletePhoto(ctx.params.photoId, session)),
)
