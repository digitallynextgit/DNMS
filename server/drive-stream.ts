import "server-only"

import { NextResponse } from "next/server"
import { Readable } from "node:stream"
import { streamDriveFile } from "@/lib/google-drive"

// =============================================================================
// Turning a Drive file into an HTTP response the browser will PLAY.
//
// Three routes need this - the public share link, the portal's own View button,
// and the staff equivalent - and they must behave identically, because the thing
// that breaks when they drift is subtle: a <video> element seeks by asking for a
// byte range, so a response that forgets `Accept-Ranges` or drops
// `Content-Range` gives a clip that plays from the start and silently refuses to
// scrub. Worth writing once.
// =============================================================================

/**
 * Stream one Drive file back to the caller.
 *
 * `range` is the caller's own Range header, forwarded untouched; Drive does the
 * arithmetic and its 206 + Content-Range come straight back out.
 *
 * Caching is `private, no-store` on purpose. For the public route the secret is
 * IN the URL, so a shared cache holding a copy would keep serving it after the
 * link is revoked - which would quietly undo the one property that makes
 * app-served share links safer than a Drive "anyone" permission.
 */
export async function driveFileResponse(
  driveFileId: string,
  file: { fileName: string; mimeType: string },
  range: string | null,
  logTag: string,
): Promise<NextResponse> {
  try {
    const s = await streamDriveFile(driveFileId, range)

    const headers = new Headers({
      "Content-Type": file.mimeType || s.contentType,
      // Play in the tab rather than download; the name still rides along so
      // "Save video as" suggests something sensible. Quotes and backslashes are
      // stripped - a filename is user input and this is a quoted header value.
      "Content-Disposition": `inline; filename="${file.fileName.replace(/["\\]/g, "")}"`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    })
    if (s.contentLength) headers.set("Content-Length", s.contentLength)
    if (s.contentRange) headers.set("Content-Range", s.contentRange)

    return new NextResponse(Readable.toWeb(Readable.from(s.body)) as ReadableStream, {
      status: s.status,
      headers,
    })
  } catch (error) {
    // A trashed Drive file 404s; anything else is ours to look at. Either way
    // the caller gets a bare message - never a Drive error naming the file id.
    const status = (error as { code?: number })?.code === 404 ? 404 : 500
    if (status === 500) console.error(`[${logTag}] stream failed`, error)
    return new NextResponse(status === 404 ? "Not found" : "Unavailable", { status })
  }
}
