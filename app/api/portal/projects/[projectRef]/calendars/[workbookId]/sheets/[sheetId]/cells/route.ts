import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { writeClientCalendarCells } from "@/features/client-portal/server/client-calendars.service"

// PATCH - write cells at a row position, creating the row if it does not exist.
//
// Merged rather than replacing, so the client and a staff member editing
// different columns of the same row do not overwrite each other - the same
// behaviour the staff route has.
//
// The workbook sits in the path because the service checks the sheet is
// actually in it. A flat .../calendars/[sheetId] would have addressed the sheet
// just as well, but then the calendar in the URL would be a claim nobody tested.
export const PATCH = withClientSession(
  async (
    req: NextRequest,
    { params }: { params: { projectRef: string; workbookId: string; sheetId: string } },
  ) =>
    respond(
      await writeClientCalendarCells(
        params.projectRef,
        params.workbookId,
        params.sheetId,
        await req.json().catch(() => ({})),
      ),
    ),
)
