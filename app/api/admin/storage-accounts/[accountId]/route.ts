import { NextRequest } from "next/server"
import { withAuth, respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import {
  updateStorageAccount,
  deleteStorageAccount,
} from "@/features/admin/server/storage-accounts.service"

export const PATCH = withAuth(PERMISSIONS.SETTINGS_WRITE, async (req: NextRequest, ctx, session) =>
  respond(await updateStorageAccount(ctx.params.accountId, await req.json(), session)),
)

export const DELETE = withAuth(PERMISSIONS.SETTINGS_WRITE, async (_req, ctx, session) =>
  respond(await deleteStorageAccount(ctx.params.accountId, session)),
)
