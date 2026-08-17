import { withAuth, respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { deletePhoto } from "@/features/noticeboard/server/noticeboard.service"

export const DELETE = withAuth(PERMISSIONS.GALLERY_WRITE, async (_req, ctx, session) =>
  respond(await deletePhoto(ctx.params.photoId, session)),
)
