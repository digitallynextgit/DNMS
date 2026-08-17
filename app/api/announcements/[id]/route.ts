import { NextRequest } from "next/server"
import { withAuth, respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import {
  updateAnnouncement,
  deleteAnnouncement,
} from "@/features/noticeboard/server/noticeboard.service"

export const PATCH = withAuth(
  PERMISSIONS.ANNOUNCEMENT_WRITE,
  async (req: NextRequest, ctx, session) =>
    respond(await updateAnnouncement(ctx.params.id, await req.json(), session)),
)

export const DELETE = withAuth(PERMISSIONS.ANNOUNCEMENT_WRITE, async (_req, ctx, session) =>
  respond(await deleteAnnouncement(ctx.params.id, session)),
)
