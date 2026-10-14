import { NextRequest } from "next/server"
import type { Session } from "next-auth"
import { z } from "zod"

import { withAuth } from "@/server/api-handler"
import { assertPlatformScope } from "@/server/platform-admin"
import { ok } from "@/lib/api-response"
import { PERMISSIONS } from "@/lib/constants"
import { setRepositoryStorage } from "@/features/drive/server/drive-status.service"

const bodySchema = z.object({ storage: z.enum(["b2", "drive"]) })

// Where new Repository uploads go. Stored files keep opening either way.
export const PUT = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    const { storage } = bodySchema.parse(await req.json().catch(() => ({})))
    return ok({ storage: await setRepositoryStorage(session, storage) })
  },
)
