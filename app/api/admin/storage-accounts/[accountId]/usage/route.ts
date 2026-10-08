import { NextResponse } from "next/server"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { assertPlatformScope } from "@/server/platform-admin"
import { listAllObjects } from "@/lib/storage"

// Separate from the accounts list so one unreachable bucket can't hold up the other cards.
const FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024 // B2 free tier = 10 GB

export const GET = withAuth(PERMISSIONS.SETTINGS_WRITE, async (_req, ctx, session) => {
  assertPlatformScope(session)
  try {
    const objects = await listAllObjects(ctx.params.accountId)
    return NextResponse.json({
      data: {
        totalFiles: objects.length,
        totalBytes: objects.reduce((sum, o) => sum + o.size, 0),
        freeTierBytes: FREE_TIER_BYTES,
        reachable: true,
      },
    })
  } catch (error) {
    // An unreadable bucket is reported on its own card instead of failing the whole page.
    console.error("[STORAGE_ACCOUNT_USAGE]", error)
    return NextResponse.json({
      data: {
        totalFiles: 0,
        totalBytes: 0,
        freeTierBytes: FREE_TIER_BYTES,
        reachable: false,
        error: error instanceof Error ? error.message.slice(0, 200) : "Could not read the bucket",
      },
    })
  }
})
