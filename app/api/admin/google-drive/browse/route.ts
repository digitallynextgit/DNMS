import { NextRequest } from "next/server"
import type { Session } from "next-auth"

import { withAuth } from "@/server/api-handler"
import { assertPlatformScope } from "@/server/platform-admin"
import { ok } from "@/lib/api-response"
import { PERMISSIONS } from "@/lib/constants"
import { browseDrive } from "@/features/drive/server/drive-browse.queries"

// One folder of the DNMS tree in the connected account; omit `folder` for the DNMS folder itself.
export const GET = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    const folder = req.nextUrl.searchParams.get("folder")
    return ok(await browseDrive(folder || null))
  },
)
