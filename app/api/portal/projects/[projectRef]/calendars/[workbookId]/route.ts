import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { deleteClientCalendar } from "@/features/client-portal/server/client-calendars.service"

// Only calendars the client created; the service refuses team-made ones. A hard delete, so the UI confirms.
export const DELETE = withClientSession(
  async (_req: NextRequest, { params }: { params: { projectRef: string; workbookId: string } }) =>
    respond(await deleteClientCalendar(params.projectRef, params.workbookId)),
)
