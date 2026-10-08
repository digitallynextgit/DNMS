import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import {
  getProjectDrive,
  uploadProjectFile,
} from "@/features/projects/server/project-drive.service"
import type { Session } from "next-auth"

// Same limit as the Backblaze path (resources/route.ts). nginx's client_max_body_size must be >= this.
const MAX_BYTES = 250 * 1024 * 1024

export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      return NextResponse.json({ data: await getProjectDrive(ctx.params.id) })
    } catch (error) {
      console.error("[PROJECT_DRIVE_GET]", error)
      return NextResponse.json({ error: "Failed to read Drive" }, { status: 500 })
    }
  },
)

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const form = await req.formData()
      const file = form.get("file")
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "File must be 250 MB or smaller" }, { status: 413 })
      }
      // Absent = the project's root folder; a folder's Drive mirror is created on demand.
      const folderIdRaw = form.get("folderId")
      const folderId = typeof folderIdRaw === "string" && folderIdRaw ? folderIdRaw : null
      const buffer = Buffer.from(await file.arrayBuffer())
      const uploaded = await uploadProjectFile(
        ctx.params.id,
        file.name,
        file.type || "application/octet-stream",
        buffer,
        folderId,
      )
      return NextResponse.json({ data: uploaded })
    } catch (error) {
      console.error("[PROJECT_DRIVE_POST]", error)
      // Surface the real reason (quota, permissions, size, network) - it's an internal tool.
      const msg = error instanceof Error ? error.message : "Upload failed"
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  },
)
