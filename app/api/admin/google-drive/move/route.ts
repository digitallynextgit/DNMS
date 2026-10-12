import { NextRequest } from "next/server"
import type { Session } from "next-auth"
import { z } from "zod"

import { withAuth } from "@/server/api-handler"
import { assertPlatformScope } from "@/server/platform-admin"
import { ok } from "@/lib/api-response"
import { PERMISSIONS } from "@/lib/constants"
import { getMoveState, startMove } from "@/features/drive/server/drive-move.service"

const bodySchema = z.object({ projectId: z.string().min(1).nullable().default(null) })

// The move into Drive: per-project counts and the running job (GET), start one project or all (POST).

export const GET = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    return ok(await getMoveState())
  },
)

export const POST = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    const { projectId } = bodySchema.parse(await req.json().catch(() => ({})))
    return ok(await startMove(projectId))
  },
)
