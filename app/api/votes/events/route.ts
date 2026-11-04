import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { listEvents, createEvent } from "@/features/votes/server/votes.service"

// Every employee sees published events; ?manage=1 is the admin/HR view (drafts, live counts).
export const GET = withSession(async (req: NextRequest, _ctx, session) =>
  respond(await listEvents(session, req.nextUrl.searchParams.get("manage") === "1")),
)

export const POST = withSession(async (req: NextRequest, _ctx, session) =>
  respond(await createEvent(await req.json(), session), 201),
)
