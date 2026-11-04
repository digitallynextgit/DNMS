import { NextRequest, NextResponse } from "next/server"
import { getSession, withSession, respond } from "@/server/api-handler"
import { getCachedSignedUrl } from "@/lib/storage"
import { optionPhotoKey, setOptionPhoto } from "@/features/votes/server/votes.service"

export const runtime = "nodejs"

// Staff-only images, served like gallery photos: a short-lived signed redirect, never cached
// longer than the signature lives.
const SIGNED_TTL_SECONDS = 24 * 60 * 60
const CACHE_SECONDS = 12 * 60 * 60

export async function GET(_req: NextRequest, ctx: { params: Promise<{ optionId: string }> }) {
  const session = await getSession()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (session.user.kind === "client") return new NextResponse("Forbidden", { status: 403 })

  const { optionId } = await ctx.params
  const key = await optionPhotoKey(optionId)
  if (!key) return new NextResponse("Not found", { status: 404 })

  try {
    const url = await getCachedSignedUrl(key, SIGNED_TTL_SECONDS, CACHE_SECONDS + 60)
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": `private, max-age=${CACHE_SECONDS}` },
    })
  } catch (error) {
    console.error("[VOTE_OPTION_PHOTO]", error)
    return new NextResponse("Unavailable", { status: 500 })
  }
}

export const POST = withSession(async (req: NextRequest, ctx, session) => {
  const form = await req.formData()
  const file = form.get("photo")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach the image as the 'photo' field" }, { status: 400 })
  }
  return respond(await setOptionPhoto(ctx.params.optionId, file, session))
})
