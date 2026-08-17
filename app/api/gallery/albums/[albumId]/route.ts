import { withSession, withAuth, respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { getAlbum, deleteAlbum } from "@/features/noticeboard/server/noticeboard.service"

export const GET = withSession(async (_req, ctx) => respond(await getAlbum(ctx.params.albumId)))

export const DELETE = withAuth(PERMISSIONS.GALLERY_WRITE, async (_req, ctx, session) =>
  respond(await deleteAlbum(ctx.params.albumId, session)),
)
