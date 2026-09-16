import { NextRequest, NextResponse } from "next/server"
import { withClientSession } from "@/server/api-handler"
import { requireClientModule } from "@/server/client-guard"
import { db } from "@/server/db"
import { driveFileResponse } from "@/server/drive-stream"

// GET - stream a Drive-hosted plan asset to a SIGNED-IN portal user.
//
// Not a duplicate of the public /api/public/share/<token> route: that one is
// guarded by a secret in the URL and survives being forwarded to outsiders, this
// one is guarded by the client session and keeps working after a share link is
// revoked. The portal's own View button must not depend on a link the client can
// withdraw - and it cannot use Drive's webViewLink either, because a portal
// client has no Google account in that Workspace and would be shown a
// request-access page instead of the video they just uploaded.
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

    return driveFileResponse(file.driveFileId, file, req.headers.get("range"), "PORTAL_STREAM")
  },
)
