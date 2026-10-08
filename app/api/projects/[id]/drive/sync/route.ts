import { NextRequest, NextResponse } from "next/server"
import { withProjectManager } from "@/features/projects/server/project-access"
import { syncProjectFolderAccess } from "@/features/projects/server/project-drive.service"
import type { Session } from "next-auth"

// Re-aligns the folder's shared-with list to the current project members.
export const POST = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const r = await syncProjectFolderAccess(ctx.params.id)
      return NextResponse.json({
        data: { ...r, message: `${r.members} member(s) have access.` },
      })
    } catch (error) {
      console.error("[PROJECT_DRIVE_SYNC]", error)
      return NextResponse.json({ error: "Sync failed" }, { status: 500 })
    }
  },
)
