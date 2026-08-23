import { NextRequest, NextResponse } from "next/server"
import { withProjectManager } from "@/features/projects/server/project-access"
import { trashProjectFile } from "@/features/projects/server/project-drive.service"
import type { Session } from "next-auth"

// DELETE /api/projects/[id]/drive/file  body { fileId }
// Move a file/folder to the Shared Drive trash (recoverable). Managers only.
export const DELETE = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { fileId } = (await req.json()) as { fileId?: string }
      if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 })
      // ctx.params.id is the resolved project id (withProjectManager). The service
      // verifies the file belongs to this project's folder before trashing (SEC-07).
      const ok = await trashProjectFile(ctx.params.id, fileId)
      if (!ok)
        return NextResponse.json({ error: "File not found in this project" }, { status: 404 })
      return NextResponse.json({ data: { ok: true } })
    } catch (error) {
      console.error("[PROJECT_DRIVE_FILE_DELETE]", error)
      return NextResponse.json({ error: "Delete failed" }, { status: 500 })
    }
  },
)
