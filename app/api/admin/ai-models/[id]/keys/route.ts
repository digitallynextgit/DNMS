import { NextRequest } from "next/server"
import type { Session } from "next-auth"

import { withAuth } from "@/server/api-handler"
import { assertPlatformScope } from "@/server/platform-admin"
import { ok } from "@/lib/api-response"
import { PERMISSIONS } from "@/lib/constants"
import { aiKeyCreateSchema } from "@/features/ai-models/schemas/ai-models.schema"
import { addAiKey } from "@/features/ai-models/server/ai-models.service"

// Another key for a provider: tried after its existing keys when they fail or run out.
export const POST = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    const input = aiKeyCreateSchema.parse(await req.json().catch(() => ({})))
    return ok(await addAiKey(session, ctx.params.id!, input), { status: 201 })
  },
)
