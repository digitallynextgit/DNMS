import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { exportProjectDriveSheet } from "@/features/projects/server/project-drive.service"

// POST /api/projects/[id]/drive/export  body { fileId }
// A Google Sheet from the project's Drive folder as an .xlsx (all tabs), for
// the sheet importer. Binary response, not the JSON envelope: the browser hands
// the bytes straight to the spreadsheet parser.
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const { fileId } = (await req.json().catch(() => ({}))) as { fileId?: unknown }
    if (typeof fileId !== "string" || !fileId) {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 })
    }
    try {
      const out = await exportProjectDriveSheet(ctx.params.id, fileId)
      if (!out) {
        return NextResponse.json(
          { error: "That sheet is not in this project's Drive folder" },
          { status: 404 },
        )
      }
      return new NextResponse(new Uint8Array(out.data), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(out.name)}.xlsx"`,
        },
      })
    } catch (error) {
      console.error("[PROJECT_DRIVE_EXPORT]", error)
      const msg = error instanceof Error ? error.message : "Export failed"
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  },
)
