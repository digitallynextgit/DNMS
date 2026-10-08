import { NextRequest, NextResponse } from "next/server"
import { inPublicApiTenant } from "@/server/public-api"
import { db } from "@/server/db"
import { getSignedUrl } from "@/lib/storage"

// Deliberately unauthenticated: mail clients (and Gmail's image proxy) send no cookies. Serves only
// project_mailer_assets rows; the uuid is the guard.
export const runtime = "nodejs"

// The cache window must never outlive the signature (Gmail's proxy caches the 302): sign for the
// 7-day maximum and let the cache expire a day earlier.
const SIGNED_TTL_SECONDS = 7 * 24 * 60 * 60
const CACHE_SECONDS = 6 * 24 * 60 * 60

/** assetId -> objectKey never changes (a new upload is a new row), so cache it; bounded against scraping. */
const keyCache = new Map<string, string>()
const KEY_CACHE_MAX = 500

export async function GET(_req: NextRequest, ctx: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await ctx.params

  let objectKey = keyCache.get(assetId)
  if (!objectKey) {
    // Inside a try: every mail client rendering the image hits this, so a throw would repeat.
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
      // Not `immutable`: the target is re-signed, and caches must not keep a redirect past its signature.
      headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` },
    })
  } catch (error) {
    console.error("[MAILER_IMAGE]", error)
    return new NextResponse("Unavailable", { status: 500 })
  }
}
