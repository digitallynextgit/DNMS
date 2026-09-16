import { NextRequest, NextResponse } from "next/server"
import { withClientSession } from "@/server/api-handler"
import { requireClientModule } from "@/server/client-guard"
import { db } from "@/server/db"
import { driveFileResponse } from "@/server/drive-stream"

// GET - stream a Drive-hosted file to a SIGNED-IN portal user, guarded by the
// DOCUMENTS module.
//
// Deliberately separate from the plan module's stream route rather than shared:
// the two modules are granted independently, and a client who was given only one
// of them must not reach the other's files through a route that happens to check
// the wrong guard. The body of the response is identical - see server/drive-stream.
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

    return driveFileResponse(file.driveFileId, file, req.headers.get("range"), "PORTAL_DOC_STREAM")
  },
)
