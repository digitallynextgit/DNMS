import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import {
  moveProjectDriveFile,
  renameProjectDriveFile,
  trashProjectFile,
} from "@/features/projects/server/project-drive.service"
import { driveFilePatchSchema } from "@/features/projects/schemas/files.schema"
import type { Session } from "next-auth"

// PATCH /api/projects/[id]/drive/file  body { fileId, name?, folderId? }
// Rename and/or move a Drive file into a Files-tab folder (null = project
// root). Any member: both are recoverable, unlike DELETE below. The service
// refuses files that are not under this project's Drive folder (SEC-07).
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
