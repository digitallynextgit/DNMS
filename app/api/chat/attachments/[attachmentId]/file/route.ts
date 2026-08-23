import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { getSession } from "@/server/api-handler"
import { getSignedUrl, getCachedSignedUrl } from "@/lib/storage"

export const runtime = "nodejs"

// Signature must OUTLIVE the cache window, or a cached redirect starts serving
// 403s. Same invariant as the gallery and mailer image routes.
const SIGNED_TTL_SECONDS = 24 * 60 * 60
const CACHE_SECONDS = 12 * 60 * 60

/**
 * GET /api/chat/attachments/:id/file
 *
 * These are PRIVATE messages, so membership is checked on every request: being
 * signed in is not enough, you have to be in the conversation the file hangs
 * from. Guessing an id gets you a 404, not somebody's photo.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ attachmentId: string }> }) {
  const wantsDownload = req.nextUrl.searchParams.get("download") === "1"
  const session = await getSession()
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 })
  if (session.user.kind === "client") return new NextResponse("Forbidden", { status: 403 })

  const { attachmentId } = await ctx.params
  const attachment = await db.chatAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      objectKey: true,
      fileName: true,
      contentType: true,
      message: { select: { conversationId: true } },
    },
  })
  if (!attachment) return new NextResponse("Not found", { status: 404 })

  const member = await db.conversationParticipant.findUnique({
    where: {
      conversationId_employeeId: {
        conversationId: attachment.message.conversationId,
        employeeId: session.user.id,
      },
    },
    select: { conversationId: true },
  })
  // 404, not 403: telling a stranger the file exists is itself a leak.
  if (!member) return new NextResponse("Not found", { status: 404 })

  try {
    // Only a deliberate download is named and forced. Leaving it off for
    // pictures and video is what lets them render inline instead of landing in
    // the downloads folder the moment the thread scrolls past them.
    const url = wantsDownload
      ? await getSignedUrl(attachment.objectKey, SIGNED_TTL_SECONDS, {
          downloadFileName: attachment.fileName,
        })
      : await getCachedSignedUrl(attachment.objectKey, SIGNED_TTL_SECONDS, CACHE_SECONDS + 60)
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": `private, max-age=${CACHE_SECONDS}` },
    })
  } catch (error) {
    console.error("[CHAT_ATTACHMENT]", error)
    return new NextResponse("Unavailable", { status: 500 })
  }
}
