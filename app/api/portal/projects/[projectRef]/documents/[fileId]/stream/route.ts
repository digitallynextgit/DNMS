import { NextRequest, NextResponse } from "next/server"
import { withClientSession } from "@/server/api-handler"
import { requireClientModule } from "@/server/client-guard"
import { db } from "@/server/db"
import { driveFileResponse } from "@/server/drive-stream"

// Separate from the plan module's stream route: the modules are granted independently, so each
// route checks its own guard.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string; fileId: string } }) => {
    const { grant } = await requireClientModule(params.projectRef, "documents")

    const file = await db.projectResource.findFirst({
      where: { id: params.fileId, projectId: grant.projectId, isClientVisible: true },
      select: { driveFileId: true, fileName: true, mimeType: true },
    })
    if (!file?.driveFileId) return new NextResponse("Not found", { status: 404 })

    // Authed route: let the viewer's browser cache the bytes (see drive-stream.ts).
    return driveFileResponse(
      file.driveFileId,
      file,
      req.headers.get("range"),
      "PORTAL_DOC_STREAM",
      "private, max-age=3600",
    )
  },
)
