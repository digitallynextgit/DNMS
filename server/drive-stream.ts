import "server-only"

import { NextResponse } from "next/server"
import { Readable } from "node:stream"
import { streamDriveFile } from "@/lib/google-drive"

/**
 * Stream a Drive file the browser can play AND seek (Range forwarded, Accept-Ranges /
 * Content-Range kept). The public share route must keep the default `private, no-store`: its
 * secret is in the URL, so a cached copy would outlive revoking the link.
 */
export async function driveFileResponse(
  driveFileId: string,
  file: { fileName: string; mimeType: string },
  range: string | null,
  logTag: string,
  cacheControl = "private, no-store",
): Promise<NextResponse> {
  try {
    const s = await streamDriveFile(driveFileId, range)

    const headers = new Headers({
      "Content-Type": file.mimeType || s.contentType,
      // Quotes/backslashes stripped: the name is user input inside a quoted header value.
      "Content-Disposition": `inline; filename="${file.fileName.replace(/["\\]/g, "")}"`,
      "Accept-Ranges": "bytes",
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    })
    if (s.contentLength) headers.set("Content-Length", s.contentLength)
    if (s.contentRange) headers.set("Content-Range", s.contentRange)

    return new NextResponse(Readable.toWeb(Readable.from(s.body)) as ReadableStream, {
      status: s.status,
      headers,
    })
  } catch (error) {
    // Bare message only - a Drive error would name the file id.
    const status = (error as { code?: number })?.code === 404 ? 404 : 500
    if (status === 500) console.error(`[${logTag}] stream failed`, error)
    return new NextResponse(status === 404 ? "Not found" : "Unavailable", { status })
  }
}
