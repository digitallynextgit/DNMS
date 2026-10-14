import { NextRequest } from "next/server"
import type { Session } from "next-auth"

import { withAuth } from "@/server/api-handler"
import { assertPlatformScope } from "@/server/platform-admin"
import { ok } from "@/lib/api-response"
import { PERMISSIONS } from "@/lib/constants"
import { testAiProviderKey } from "@/features/ai-models/server/ai-models.service"

export const runtime = "nodejs"

// "Test": one short request on this key alone, so a wrong or spent key shows before a real task hits it.
export const POST = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    return ok(await testAiProviderKey(ctx.params.id!, ctx.params.keyId!))
  },
)
