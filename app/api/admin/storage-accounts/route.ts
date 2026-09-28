import { NextRequest } from "next/server"
import { withAuth, respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { assertPlatformScope } from "@/server/platform-admin"
import {
  listStorageAccounts,
  createStorageAccount,
} from "@/features/admin/server/storage-accounts.service"

// Storage credentials are administrative config - same gate as the rest of
// Integrations, PLUS the platform scope: StorageAccount has no tenantId, so
// settings:write alone would hand every tenant's admin the shared credentials.
export const GET = withAuth(PERMISSIONS.SETTINGS_WRITE, async (_req, _ctx, session) => {
  assertPlatformScope(session)
  return respond(await listStorageAccounts())
})

export const POST = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (req: NextRequest, _ctx, session) => {
    assertPlatformScope(session)
    return respond(await createStorageAccount(await req.json(), session), 201)
  },
)
