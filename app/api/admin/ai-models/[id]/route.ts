import { NextRequest } from "next/server"
import type { Session } from "next-auth"

import { withAuth } from "@/server/api-handler"
import { assertPlatformScope } from "@/server/platform-admin"
import { ok } from "@/lib/api-response"
import { PERMISSIONS } from "@/lib/constants"
import { aiProviderUpdateSchema } from "@/features/ai-models/schemas/ai-models.schema"
import { deleteAiProvider, updateAiProvider } from "@/features/ai-models/server/ai-models.service"

// One provider: rename, change models, switch on/off, make default, move in the order, or remove.

export const PATCH = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    const input = aiProviderUpdateSchema.parse(await req.json().catch(() => ({})))
    await updateAiProvider(session, ctx.params.id!, input)
    return ok({ updated: true })
  },
)

export const DELETE = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    await deleteAiProvider(session, ctx.params.id!)
    return ok({ deleted: true })
  },
)
