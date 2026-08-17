import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { listUpcomingBirthdays } from "@/features/noticeboard/server/noticeboard.service"

// GET /api/birthdays?days=30 - today's and upcoming birthdays. No birth YEAR is
// ever returned; see the service.
export const GET = withSession(async (req: NextRequest) => {
  const days = Number(req.nextUrl.searchParams.get("days"))
  return respond(await listUpcomingBirthdays(Number.isFinite(days) && days > 0 ? days : 30))
})
