import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import {
  listClientCalendars,
  createClientCalendar,
} from "@/features/client-portal/server/client-calendars.service"

// GET - the calendars this project has SHARED with its client, each with its
// tabs, columns and rows. Unshared ones are filtered out in the service, which
// is the only place the portal reads workbooks from.
export const GET = withClientSession(
  async (_req: NextRequest, { params }: { params: { projectRef: string } }) =>
    respond(await listClientCalendars(params.projectRef)),
)

// POST - the client creates a calendar of their own. It lands shared (they made
// it) and otherwise behaves like any calendar on the project.
export const POST = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string } }) =>
    respond(await createClientCalendar(params.projectRef, await req.json().catch(() => ({}))), 201),
)
