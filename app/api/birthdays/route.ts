import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import {
  listUpcomingBirthdays,
  listBirthdaysForYear,
} from "@/features/noticeboard/server/noticeboard.service"

export const GET = withSession(async (req: NextRequest) => {
  const year = req.nextUrl.searchParams.get("year")
  if (year) return respond(await listBirthdaysForYear(Number(year)))
  const days = Number(req.nextUrl.searchParams.get("days"))
  return respond(await listUpcomingBirthdays(Number.isFinite(days) && days > 0 ? days : 30))
})
