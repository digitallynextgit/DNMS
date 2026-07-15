import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import {
  getProjectDrive,
  uploadProjectFile,
} from "@/features/projects/server/project-drive.service"
import type { Session } from "next-auth"

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB per upload

// GET /api/projects/[id]/drive - the project's Drive folder + its files.
// Any project member (owner / team member / project:read) may view.
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

// POST /api/projects/[id]/drive - upload a file into the project folder (members).
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const form = await req.formData()
      const file = form.get("file")
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "File must be 50 MB or smaller" }, { status: 413 })
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const uploaded = await uploadProjectFile(
        ctx.params.id,
        file.name,
        file.type || "application/octet-stream",
        buffer,
      )
      return NextResponse.json({ data: uploaded })
    } catch (error) {
      console.error("[PROJECT_DRIVE_POST]", error)
      return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }
  },
)
