import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { listAlbums, createAlbum } from "@/features/noticeboard/server/noticeboard.service"

// Everyone can browse the gallery AND start an album: uploads are open to every
// employee, and an upload needs somewhere to go. Deleting an album (which takes
// everyone else's photos with it) still needs gallery:write.
export const GET = withSession(async (req: NextRequest) =>
  respond(await listAlbums(req.nextUrl.searchParams.get("search") ?? undefined)),
)

export const POST = withSession(async (req, _ctx, session) =>
  respond(await createAlbum(await req.json(), session), 201),
)
