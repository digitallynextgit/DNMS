import { NextRequest } from "next/server"
import { withAuth, respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { assertPlatformScope } from "@/server/platform-admin"
import {
  listStorageAccounts,
  createStorageAccount,
} from "@/features/admin/server/storage-accounts.service"

// Also needs platform scope: StorageAccount has no tenantId, so settings:write alone would
// expose the shared credentials to every tenant's admin.
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
