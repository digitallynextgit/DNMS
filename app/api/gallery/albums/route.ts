import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { listAlbums, createAlbum } from "@/features/noticeboard/server/noticeboard.service"

// Every employee can browse and start albums (uploads are open); deleting one needs gallery:write.
export const GET = withSession(async (req: NextRequest) =>
  respond(await listAlbums(req.nextUrl.searchParams.get("search") ?? undefined)),
)

export const POST = withSession(async (req, _ctx, session) =>
  respond(await createAlbum(await req.json(), session), 201),
)
