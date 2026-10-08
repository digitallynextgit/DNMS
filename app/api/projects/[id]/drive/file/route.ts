import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import {
  moveProjectDriveFile,
  renameProjectDriveFile,
  trashProjectFile,
} from "@/features/projects/server/project-drive.service"
import { driveFilePatchSchema } from "@/features/projects/schemas/files.schema"
import type { Session } from "next-auth"

// Any member may rename/move (recoverable). The service refuses files outside this project's Drive folder.
export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const input = driveFilePatchSchema.parse(await req.json().catch(() => ({})))
    let file = null
    if (input.folderId !== undefined) {
      file = await moveProjectDriveFile(ctx.params.id, input.fileId, input.folderId)
      if (!file)
        return NextResponse.json({ error: "File not found in this project" }, { status: 404 })
    }
    if (input.name !== undefined) {
      file = await renameProjectDriveFile(ctx.params.id, input.fileId, input.name)
      if (!file)
        return NextResponse.json({ error: "File not found in this project" }, { status: 404 })
    }
    return NextResponse.json({ data: file })
  },
)

// Moves to the Shared Drive trash (recoverable).
export const DELETE = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { fileId } = (await req.json()) as { fileId?: string }
      if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 })
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
