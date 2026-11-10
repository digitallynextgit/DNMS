import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import {
  listWeeklyImpact,
  saveWeeklyImpact,
} from "@/features/projects/server/weekly-impact.service"

// ?week=<Monday>&employeeId=<id> (My Tasks) or ?week=<Monday>&projectId=<id> (a project's Tasks tab).
export const GET = withSession(async (req: NextRequest, _ctx, session) =>
  respond(await listWeeklyImpact(Object.fromEntries(req.nextUrl.searchParams), session)),
)

export const PUT = withSession(async (req: NextRequest, _ctx, session) =>
  respond(await saveWeeklyImpact(await req.json(), session)),
)
