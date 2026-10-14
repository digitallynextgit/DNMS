import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withAuth } from "@/server/api-handler"
import { assertPlatformScope } from "@/server/platform-admin"
import { PERMISSIONS } from "@/lib/constants"
import { getAccountFile } from "@/lib/google-drive"
import { driveFileResponse } from "@/server/drive-stream"
import { assertDriveId } from "@/features/drive/server/drive-browse.queries"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Download from the Storage page's Drive browser: the admin may not be on the file's project team.
export const GET = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    const id = req.nextUrl.searchParams.get("id") ?? ""
    assertDriveId(id)
    const file = await getAccountFile(id)
    if (!file || file.isFolder || file.mimeType.startsWith("application/vnd.google-apps.")) {
      return new NextResponse("Not found", { status: 404 })
    }
    return driveFileResponse(
      id,
      { fileName: file.name, mimeType: file.mimeType },
      req.headers.get("range"),
      "ADMIN_DRIVE_FILE",
      "private, no-store",
      "attachment",
    )
  },
)
