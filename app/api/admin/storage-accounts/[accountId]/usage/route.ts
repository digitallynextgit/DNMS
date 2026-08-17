import { NextResponse } from "next/server"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { listAllObjects } from "@/lib/storage"

// GET /api/admin/storage-accounts/:id/usage
//
// Deliberately SEPARATE from the accounts list, and deliberately light: it lists
// the bucket, which is a network round trip per account. Keeping it out of the
// list means the cards render immediately, each fills in its own usage, and one
// unreachable bucket cannot stop the others from appearing.
//
// No ownership resolution here - that is the full Storage screen's job. This
// answers "how big is it", not "what is in it".
const FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024 // B2 free tier = 10 GB

export const GET = withAuth(PERMISSIONS.SETTINGS_WRITE, async (_req, ctx) => {
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
    // A bucket we cannot read is reported as such on its own card, rather than
    // failing the whole page.
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
