import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { getSession } from "@/server/api-handler"
import { getSignedUrl, getCachedSignedUrl } from "@/lib/storage"

export const runtime = "nodejs"

// Must outlive the cache window, or a cached redirect starts serving 403s.
const SIGNED_TTL_SECONDS = 24 * 60 * 60
const CACHE_SECONDS = 12 * 60 * 60

// Private messages: only members of the conversation may fetch the file.
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
    // Only a deliberate download sets the filename; images and video must render inline.
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
