import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { writeClientCalendarCells } from "@/features/client-portal/server/client-calendars.service"

// Merged, not replaced, so client and staff editing different columns don't overwrite each other.
// The workbook is in the path so the service can check the sheet belongs to it.
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
