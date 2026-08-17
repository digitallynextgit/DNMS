import { withAuth, respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { testStorageAccount } from "@/features/admin/server/storage-accounts.service"

export const POST = withAuth(PERMISSIONS.SETTINGS_WRITE, async (_req, ctx, session) =>
  respond(await testStorageAccount(ctx.params.accountId, session)),
)
