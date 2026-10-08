import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { getSession } from "@/server/api-handler"
import { canAccessProject } from "@/features/projects/server/project-access"
import { getSignedUrl, getCachedSignedUrl } from "@/lib/storage"

export const runtime = "nodejs"

// Must outlive the cache window, or a cached redirect starts serving 403s.
const SIGNED_TTL_SECONDS = 24 * 60 * 60
const CACHE_SECONDS = 12 * 60 * 60

// Not nested under /projects/:id/: access comes from the attachment's own row, not a swappable URL id.
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
    console.error("[PROJECT_MESSAGE_ATTACHMENT]", error)
    return new NextResponse("Unavailable", { status: 500 })
  }
}
