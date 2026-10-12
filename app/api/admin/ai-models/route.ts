import { NextRequest } from "next/server"
import type { Session } from "next-auth"

import { withAuth } from "@/server/api-handler"
import { assertPlatformScope } from "@/server/platform-admin"
import { ok } from "@/lib/api-response"
import { PERMISSIONS } from "@/lib/constants"
import { aiProviderCreateSchema } from "@/features/ai-models/schemas/ai-models.schema"
import { createAiProvider, listAiProviders } from "@/features/ai-models/server/ai-models.service"

// Admin -> AI Models: the providers (and their keys, last 4 characters only) DNMS tries, in order.

export const GET = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    return ok(await listAiProviders())
  },
)

export const POST = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    const input = aiProviderCreateSchema.parse(await req.json().catch(() => ({})))
    const p = await createAiProvider(session, input)
    return ok({ id: p.id }, { status: 201 })
  },
)
