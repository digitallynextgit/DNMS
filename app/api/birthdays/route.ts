import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import {
  listUpcomingBirthdays,
  listBirthdaysForYear,
} from "@/features/noticeboard/server/noticeboard.service"

// GET /api/birthdays?days=30 - today's and upcoming birthdays.
// GET /api/birthdays?year=2026 - every birthday in that year, for the Birthday Calendar.
// No birth YEAR is ever returned; see the service.
export const GET = withSession(async (req: NextRequest) => {
  const year = req.nextUrl.searchParams.get("year")
  if (year) return respond(await listBirthdaysForYear(Number(year)))
  const days = Number(req.nextUrl.searchParams.get("days"))
  return respond(await listUpcomingBirthdays(Number.isFinite(days) && days > 0 ? days : 30))
})
