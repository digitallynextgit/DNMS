import { NextRequest } from "next/server"
import { withSession, withAuth, respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { listAlbums, createAlbum } from "@/features/noticeboard/server/noticeboard.service"

// Everyone can browse the gallery; only gallery:write can add to it.
export const GET = withSession(async (req: NextRequest) =>
  respond(await listAlbums(req.nextUrl.searchParams.get("search") ?? undefined)),
)

export const POST = withAuth(PERMISSIONS.GALLERY_WRITE, async (req, _ctx, session) =>
  respond(await createAlbum(await req.json(), session), 201),
)
