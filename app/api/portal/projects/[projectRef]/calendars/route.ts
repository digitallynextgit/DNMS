import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import {
  listClientCalendars,
  createClientCalendar,
} from "@/features/client-portal/server/client-calendars.service"

// Only calendars shared with the client (filtered in the service).
export const GET = withClientSession(
  async (_req: NextRequest, { params }: { params: { projectRef: string } }) =>
    respond(await listClientCalendars(params.projectRef)),
)

// A client-made calendar lands shared.
export const POST = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string } }) =>
    respond(await createClientCalendar(params.projectRef, await req.json().catch(() => ({}))), 201),
)
