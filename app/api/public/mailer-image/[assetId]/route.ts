import { NextRequest, NextResponse } from "next/server"
import { inPublicApiTenant } from "@/server/public-api"
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

// THE CACHE WINDOW MUST NEVER OUTLIVE THE SIGNATURE.
//
// This shipped as a 1-hour signature behind a 7-day `max-age`, and it broke
// exactly as you would expect: Gmail's proxy cached the 302 for a week, the
// signature inside it died after an hour, and every recipient who opened the
// mail later got a 403 from Backblaze instead of an image. It looked fine to
// anyone testing, because a fresh click always re-signs.
//
// So: sign for the 7-day SigV4 maximum, and let the cache expire a day BEFORE
// that. A cached redirect is then always still valid, and the refetch mints a
// new one. Any change here has to keep that inequality true.
const SIGNED_TTL_SECONDS = 7 * 24 * 60 * 60
const CACHE_SECONDS = 6 * 24 * 60 * 60

/**
 * assetId -> objectKey. The mapping is immutable (a new upload is a new row), so
 * this is safe to hold forever and saves a database round trip on the request an
 * inbox is waiting on. Bounded so a scraped id space cannot grow it without end.
 */
const keyCache = new Map<string, string>()
const KEY_CACHE_MAX = 500

export async function GET(_req: NextRequest, ctx: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await ctx.params

  let objectKey = keyCache.get(assetId)
  if (!objectKey) {
    // This lookup used to sit OUTSIDE the try below, so anything it threw
    // escaped the handler. It is a public endpoint - every mail client that
    // renders the image hits it - so a throw here is a repeating fault.
    let asset: { objectKey: string } | null
    try {
      asset = await inPublicApiTenant(() =>
        db.projectMailerAsset.findUnique({
          where: { id: assetId },
          select: { objectKey: true },
        }),
      )
    } catch (error) {
      console.error("[MAILER_IMAGE] lookup failed", error)
      return new NextResponse("Unavailable", { status: 500 })
    }
    if (!asset) return new NextResponse("Not found", { status: 404 })
    objectKey = asset.objectKey
    if (keyCache.size >= KEY_CACHE_MAX) keyCache.clear()
    keyCache.set(assetId, objectKey)
  }

  try {
    const url = await getSignedUrl(objectKey, SIGNED_TTL_SECONDS)
    return NextResponse.redirect(url, {
      status: 302,
      // NOT `immutable`: the target rotates every time it is re-signed, and
      // `immutable` invites a cache to keep serving a redirect whose signature
      // has since expired - the exact failure this route already had once.
      headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` },
    })
  } catch (error) {
    console.error("[MAILER_IMAGE]", error)
    return new NextResponse("Unavailable", { status: 500 })
  }
}
