import { NextRequest, NextResponse } from "next/server"
import { withProjectManager } from "@/features/projects/server/project-access"
import { trashProjectFile } from "@/features/projects/server/project-drive.service"
import type { Session } from "next-auth"

// DELETE /api/projects/[id]/drive/file  body { fileId }
// Move a file/folder to the Shared Drive trash (recoverable). Managers only.
export const DELETE = withProjectManager(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { fileId } = (await req.json()) as { fileId?: string }
      if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 })
      await trashProjectFile(fileId)
      return NextResponse.json({ data: { ok: true } })
    } catch (error) {
      console.error("[PROJECT_DRIVE_FILE_DELETE]", error)
      return NextResponse.json({ error: "Delete failed" }, { status: 500 })
    }
  },
)
