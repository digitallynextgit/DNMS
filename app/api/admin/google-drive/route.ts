import { NextRequest } from "next/server"
import type { Session } from "next-auth"

import { withAuth } from "@/server/api-handler"
import { assertPlatformScope } from "@/server/platform-admin"
import { ok } from "@/lib/api-response"
import { PERMISSIONS } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import { disconnectDrive } from "@/lib/google-drive-oauth"
import { getDriveStatus } from "@/features/drive/server/drive-status.service"

// The connected Google account behind the Repository: status for the Storage card, and disconnect.

export const GET = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    return ok(await getDriveStatus())
  },
)

export const DELETE = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    await disconnectDrive()
    await createAuditLog(session, {
      action: "SETTINGS_UPDATE",
      module: "admin",
      entityType: "AppSetting",
      entityId: "GOOGLE_DRIVE_ACCOUNT",
      changes: { googleDrive: "disconnected" },
    })
    return ok({ disconnected: true })
  },
)
