import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { db } from "@/server/db"
import { driveFileResponse } from "@/server/drive-stream"
import { getSignedUrl } from "@/lib/storage"

// A Repository file's bytes, for anyone on the project. Drive files stream through here (in Drive
// itself only the team can open them); Backblaze ones redirect to a signed URL, so one link works for both.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const { id: projectId, fileId } = ctx.params
    const download = new URL(req.url).searchParams.get("download") === "1"
    const file = await db.projectResource.findFirst({
      where: { id: fileId, projectId },
      select: { objectKey: true, driveFileId: true, fileName: true, mimeType: true },
    })
    if (!file) return new NextResponse("Not found", { status: 404 })

    if (!file.driveFileId) {
      const url = await getSignedUrl(
        file.objectKey!,
        900,
        download ? { downloadFileName: file.fileName } : undefined,
      )
      return NextResponse.redirect(url, 302)
    }

    return driveFileResponse(
      file.driveFileId,
      file,
      req.headers.get("range"),
      "RESOURCE_STREAM",
      // Authed route: the viewer's browser may keep the bytes for a while (see drive-stream.ts).
      "private, max-age=3600",
      download ? "attachment" : "inline",
    )
  },
)
