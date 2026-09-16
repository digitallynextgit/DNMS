import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { deleteClientCalendar } from "@/features/client-portal/server/client-calendars.service"

// DELETE - remove a calendar the client started themselves.
//
// The service refuses one the TEAM made: a shared calendar is their working
// document, and this endpoint is not a way to reach it. Nothing here is soft -
// the workbook, its tabs, rows and history all go - so the UI confirms first.
export const DELETE = withClientSession(
  async (_req: NextRequest, { params }: { params: { projectRef: string; workbookId: string } }) =>
    respond(await deleteClientCalendar(params.projectRef, params.workbookId)),
)
