import { NextRequest, NextResponse } from "next/server"
import { withClientSession } from "@/server/api-handler"
import { requireClientModule } from "@/server/client-guard"
import { db } from "@/server/db"
import { driveFileResponse } from "@/server/drive-stream"

// Session-guarded, unlike /api/public/share/<token>: the portal's View button must keep working after a
// share link is revoked, and Drive's own link shows clients a request-access page.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string; fileId: string } }) => {
    const { grant } = await requireClientModule(params.projectRef, "plan")

    const file = await db.projectResource.findFirst({
      where: {
        id: params.fileId,
        projectId: grant.projectId,
        isClientVisible: true,
        deliverableId: { not: null },
      },
      select: { driveFileId: true, fileName: true, mimeType: true },
    })
    if (!file?.driveFileId) return new NextResponse("Not found", { status: 404 })

    // Authed route: let the viewer's browser cache the bytes (see drive-stream.ts).
    return driveFileResponse(
      file.driveFileId,
      file,
      req.headers.get("range"),
      "PORTAL_STREAM",
      "private, max-age=3600",
    )
  },
)
