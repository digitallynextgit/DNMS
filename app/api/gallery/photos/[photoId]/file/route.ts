import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { getSession } from "@/server/api-handler"
import { getSignedUrl, getCachedSignedUrl } from "@/lib/storage"

export const runtime = "nodejs"

// AUTHENTICATED, unlike the mailer-image route: gallery photos are internal
// staff pictures, not artwork going out to an inbox. Anyone signed in may view
// them; nobody outside can.
//
// Signed URL and cache lifetime are pinned together on purpose - the cache must
// never outlive the signature, or a cached redirect starts serving 403s.
// (The mailer image route shipped that exact bug once.)
const SIGNED_TTL_SECONDS = 24 * 60 * 60
const CACHE_SECONDS = 12 * 60 * 60

export async function GET(_req: NextRequest, ctx: { params: Promise<{ photoId: string }> }) {
  const session = await getSession()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (session.user.kind === "client") return new NextResponse("Forbidden", { status: 403 })

  const { photoId } = await ctx.params
  const photo = await db.photo.findUnique({
    where: { id: photoId },
    select: { objectKey: true, thumbKey: true, fileName: true },
  })
  if (!photo) return new NextResponse("Not found", { status: 404 })

  // ?variant=thumb serves the small WebP for grid cells and covers; it falls
  // back to the master when a row has no thumb yet (video, or not-yet-backfilled
  // image), so the grid always renders something. The lightbox and downloads
  // never pass variant, so they always get the full-resolution master.
  const wantsThumb = _req.nextUrl.searchParams.get("variant") === "thumb"

  // ?download=1 signs the URL with Content-Disposition: attachment, so the file
  // saves under its original name. A plain `<a download>` cannot do this - the
  // attribute is ignored once the link redirects cross-origin to B2, so the
  // disposition has to come from the signature itself.
  const wantsDownload = _req.nextUrl.searchParams.get("download") === "1"

  // The master is always what a download saves and what the lightbox opens; only
  // an inline thumb request swaps to the small variant (when the row has one).
  const inlineKey = wantsThumb && photo.thumbKey ? photo.thumbKey : photo.objectKey

  try {
    // Inline views share a cached signed URL (perf); downloads carry a
    // per-filename disposition and are signed fresh.
    const url = wantsDownload
      ? await getSignedUrl(photo.objectKey, SIGNED_TTL_SECONDS, {
          downloadFileName: photo.fileName,
        })
      : await getCachedSignedUrl(inlineKey, SIGNED_TTL_SECONDS, CACHE_SECONDS + 60)
    return NextResponse.redirect(url, {
      status: 302,
      // `private`: a shared proxy must not hold a staff photo for other viewers.
      // Downloads are not cached at all - the two variants differ only by query
      // string, and a cached inline redirect served for a download would open
      // the file in a tab instead of saving it.
      headers: {
        "Cache-Control": wantsDownload ? "private, no-store" : `private, max-age=${CACHE_SECONDS}`,
      },
    })
  } catch (error) {
    console.error("[GALLERY_PHOTO]", error)
    return new NextResponse("Unavailable", { status: 500 })
  }
}
