import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { getSession } from "@/server/api-handler"
import { getSignedUrl, getCachedSignedUrl } from "@/lib/storage"

export const runtime = "nodejs"

// Authenticated (staff photos, unlike mailer images). The cache must never outlive the signature,
// or a cached redirect starts serving 403s.
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

  // ?variant=thumb serves the small WebP, falling back to the master when a row has no thumb.
  const wantsThumb = _req.nextUrl.searchParams.get("variant") === "thumb"

  // The disposition must be in the signature: `<a download>` is ignored after a cross-origin redirect.
  const wantsDownload = _req.nextUrl.searchParams.get("download") === "1"

  const inlineKey = wantsThumb && photo.thumbKey ? photo.thumbKey : photo.objectKey

  try {
    // Inline views share a cached signed URL; downloads are signed fresh with their filename.
    const url = wantsDownload
      ? await getSignedUrl(photo.objectKey, SIGNED_TTL_SECONDS, {
          downloadFileName: photo.fileName,
        })
      : await getCachedSignedUrl(inlineKey, SIGNED_TTL_SECONDS, CACHE_SECONDS + 60)
    return NextResponse.redirect(url, {
      status: 302,
      // `private`: no shared proxy may hold staff photos. Downloads aren't cached, or a cached inline
      // redirect could open the file in a tab instead of saving it.
      headers: {
        "Cache-Control": wantsDownload ? "private, no-store" : `private, max-age=${CACHE_SECONDS}`,
      },
    })
  } catch (error) {
    console.error("[GALLERY_PHOTO]", error)
    return new NextResponse("Unavailable", { status: 500 })
  }
}
