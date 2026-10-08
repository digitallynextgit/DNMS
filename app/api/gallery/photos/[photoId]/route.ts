import { withSession, respond } from "@/server/api-handler"
import { deletePhoto } from "@/features/noticeboard/server/noticeboard.service"

// Any employee may delete their own upload; deletePhoto() requires gallery:write for anyone else's.
export const DELETE = withSession(async (_req, ctx, session) =>
  respond(await deletePhoto(ctx.params.photoId, session)),
)
