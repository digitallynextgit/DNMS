import { NextRequest } from "next/server"
import type { Session } from "next-auth"

import { withAuth } from "@/server/api-handler"
import { assertPlatformScope } from "@/server/platform-admin"
import { ok } from "@/lib/api-response"
import { PERMISSIONS } from "@/lib/constants"
import { ValidationError } from "@/lib/errors"
import { isDriveAccountConnected } from "@/lib/google-drive-oauth"
import { runDriveBackup } from "@/features/drive/server/drive-backup.service"

// "Back up now". Runs in the background; the card follows it through the run row's status.
export const POST = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    if (!(await isDriveAccountConnected()))
      throw new ValidationError("Connect a Google account first")
    void runDriveBackup({ manual: true }).catch((e) =>
      console.error("[drive-backup] manual run failed", e),
    )
    return ok({ started: true })
  },
)
