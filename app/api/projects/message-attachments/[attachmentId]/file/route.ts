import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { getSession } from "@/server/api-handler"
import { canAccessProject } from "@/features/projects/server/project-access"
import { getSignedUrl, getCachedSignedUrl } from "@/lib/storage"

export const runtime = "nodejs"

// Signature must OUTLIVE the cache window, or a cached redirect starts serving
// 403s. Same invariant as the chat, gallery and mailer image routes.
const SIGNED_TTL_SECONDS = 24 * 60 * 60
const CACHE_SECONDS = 12 * 60 * 60

/**
 * GET /api/projects/message-attachments/:id/file
 *
 * Not nested under /projects/:id/ on purpose: the project a file belongs to is a
 * property OF the file, and taking it from the URL would let anyone with access
 * to ONE project read attachments from every other by swapping the id. Access is
 * resolved from the attachment's own row instead.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ attachmentId: string }> }) {
  const wantsDownload = req.nextUrl.searchParams.get("download") === "1"
  const session = await getSession()
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 })
  if (session.user.kind === "client") return new NextResponse("Forbidden", { status: 403 })

  const { attachmentId } = await ctx.params
  const attachment = await db.projectMessageAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      objectKey: true,
      fileName: true,
      reply: { select: { message: { select: { projectId: true } } } },
    },
  })
  if (!attachment) return new NextResponse("Not found", { status: 404 })

  // 404, not 403: telling a stranger the file exists is itself a leak.
  if (!(await canAccessProject(session, attachment.reply.message.projectId))) {
    return new NextResponse("Not found", { status: 404 })
  }

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
    console.error("[PROJECT_MESSAGE_ATTACHMENT]", error)
    return new NextResponse("Unavailable", { status: 500 })
  }
}
