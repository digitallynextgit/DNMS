import { withAuth, respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { setDefaultStorageAccount } from "@/features/admin/server/storage-accounts.service"

export const POST = withAuth(PERMISSIONS.SETTINGS_WRITE, async (_req, ctx, session) =>
  respond(await setDefaultStorageAccount(ctx.params.accountId, session)),
)
