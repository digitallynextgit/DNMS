import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { createProjectDoc } from "@/features/projects/server/project-drive.service"
import type { Session } from "next-auth"

// POST /api/projects/[id]/drive/new  body { kind: "doc"|"sheet", name, folderId? }
// Create a blank Google Doc / Sheet in the project folder (or in the Drive
// mirror of the given Files-tab folder).
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = (await req.json()) as {
        kind?: "doc" | "sheet"
        name?: string
        folderId?: string | null
      }
      const kind = body.kind === "sheet" ? "sheet" : "doc"
      const name = body.name?.trim() || (kind === "sheet" ? "Untitled sheet" : "Untitled doc")
      const folderId = typeof body.folderId === "string" && body.folderId ? body.folderId : null
      const created = await createProjectDoc(ctx.params.id, name, kind, folderId)
      return NextResponse.json({ data: created })
    } catch (error) {
      console.error("[PROJECT_DRIVE_NEW]", error)
      return NextResponse.json({ error: "Failed to create file" }, { status: 500 })
    }
  },
)
