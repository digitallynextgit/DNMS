import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { getSignedUrl } from "@/lib/storage"

// GET /api/public/mailer-image/:assetId
//
// DELIBERATELY UNAUTHENTICATED. This is fetched by the recipient's mail client
// (or Gmail's image proxy), which sends no cookies - an authenticated route
// would render every campaign image as a broken box. The uuid is the only thing
// guarding it, which is the same trade every ESP makes for tracked assets.
//
// It serves ONLY rows in project_mailer_assets, so nothing else in the bucket is
// reachable through it.
export const runtime = "nodejs"

// Signed URLs are minted per request but cached hard downstream: Gmail fetches
// once and proxies thereafter, so this is not a hot path.
const SIGNED_TTL_SECONDS = 3600

export async function GET(_req: NextRequest, ctx: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await ctx.params

  const asset = await db.projectMailerAsset.findUnique({
    where: { id: assetId },
    select: { objectKey: true },
  })
  if (!asset) return new NextResponse("Not found", { status: 404 })

  try {
    const url = await getSignedUrl(asset.objectKey, SIGNED_TTL_SECONDS)
    return NextResponse.redirect(url, {
      status: 302,
      // Public + long-lived: the object behind an id never changes, so caches and
      // image proxies should hold onto it.
      headers: { "Cache-Control": "public, max-age=604800, immutable" },
    })
  } catch (error) {
    console.error("[MAILER_IMAGE]", error)
    return new NextResponse("Unavailable", { status: 500 })
  }
}
