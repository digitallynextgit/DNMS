import { NextRequest } from "next/server"
import { withAuth, respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import {
  listStorageAccounts,
  createStorageAccount,
} from "@/features/admin/server/storage-accounts.service"

// Storage credentials are administrative config - same gate as the rest of
// Integrations.
export const GET = withAuth(PERMISSIONS.SETTINGS_WRITE, async () =>
  respond(await listStorageAccounts()),
)

export const POST = withAuth(PERMISSIONS.SETTINGS_WRITE, async (req: NextRequest, _ctx, session) =>
  respond(await createStorageAccount(await req.json(), session), 201),
)
