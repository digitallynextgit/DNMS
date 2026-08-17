import { NextRequest } from "next/server"
import { withSession, withAuth, respond } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import {
  listAnnouncements,
  createAnnouncement,
} from "@/features/noticeboard/server/noticeboard.service"

// GET - the board. Open to every signed-in employee; a notice nobody can read
// is not a notice. Managers additionally see drafts and expired items.
export const GET = withSession(async (req: NextRequest, _ctx, session) => {
  const sp = req.nextUrl.searchParams
  const month = Number(sp.get("month"))
  const year = Number(sp.get("year"))
  return respond(
    await listAnnouncements(hasPermission(session, PERMISSIONS.ANNOUNCEMENT_WRITE), {
      category: sp.get("category") ?? undefined,
      month: Number.isFinite(month) && month > 0 ? month : undefined,
      year: Number.isFinite(year) && year > 0 ? year : undefined,
      limit: Number(sp.get("limit")) || undefined,
    }),
  )
})

export const POST = withAuth(PERMISSIONS.ANNOUNCEMENT_WRITE, async (req, _ctx, session) =>
  respond(await createAnnouncement(await req.json(), session), 201),
)
