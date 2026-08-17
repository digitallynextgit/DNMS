import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { getSession } from "@/server/api-handler"
import { getSignedUrl } from "@/lib/storage"

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
  const photo = await db.photo.findUnique({ where: { id: photoId }, select: { objectKey: true } })
  if (!photo) return new NextResponse("Not found", { status: 404 })

  try {
    const url = await getSignedUrl(photo.objectKey, SIGNED_TTL_SECONDS)
    return NextResponse.redirect(url, {
      status: 302,
      // `private`: a shared proxy must not hold a staff photo for other viewers.
      headers: { "Cache-Control": `private, max-age=${CACHE_SECONDS}` },
    })
  } catch (error) {
    console.error("[GALLERY_PHOTO]", error)
    return new NextResponse("Unavailable", { status: 500 })
  }
}
