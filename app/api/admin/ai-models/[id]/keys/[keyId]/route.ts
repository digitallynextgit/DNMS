import { NextRequest } from "next/server"
import type { Session } from "next-auth"

import { withAuth } from "@/server/api-handler"
import { assertPlatformScope } from "@/server/platform-admin"
import { ok } from "@/lib/api-response"
import { PERMISSIONS } from "@/lib/constants"
import { aiKeyUpdateSchema } from "@/features/ai-models/schemas/ai-models.schema"
import { deleteAiKey, updateAiKey } from "@/features/ai-models/server/ai-models.service"

// One key: rename, switch on/off, move in the order, or remove.

export const PATCH = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    const input = aiKeyUpdateSchema.parse(await req.json().catch(() => ({})))
    await updateAiKey(session, ctx.params.id!, ctx.params.keyId!, input)
    return ok({ updated: true })
  },
)

export const DELETE = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    await deleteAiKey(session, ctx.params.id!, ctx.params.keyId!)
    return ok({ deleted: true })
  },
)
