import { NextRequest, NextResponse } from "next/server"
import { inPublicApiTenant } from "@/server/public-api"
import { db } from "@/server/db"
import { driveFileResponse } from "@/server/drive-stream"

// Deliberately unauthenticated: a client can send this link to anyone and it plays. Drive's "anyone
// with the link" is blocked in this Workspace, so the grant is a per-video token in our DB (192 random
// bits, plus is_public_link = true). Only the token is read from the URL.
export const runtime = "nodejs"

// Stream, don't buffer: a 250 MB video read into memory first would stall and spike the server.
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  // Cheap shape check before the database, so scanners cost a string comparison.
  if (!token || token.length < 20 || token.length > 64) {
    return new NextResponse("Not found", { status: 404 })
  }

  let asset: { driveFileId: string | null; fileName: string; mimeType: string } | null
  try {
    asset = await inPublicApiTenant(() =>
      db.projectResource.findFirst({
        where: { shareToken: token, isPublicLink: true },
        select: { driveFileId: true, fileName: true, mimeType: true },
      }),
    )
  } catch (error) {
    console.error("[SHARE] lookup failed", error)
    return new NextResponse("Unavailable", { status: 500 })
  }

  // Revoked, deleted or never existed all look the same, so a dead link never confirms it was real.
  if (!asset?.driveFileId) return new NextResponse("Not found", { status: 404 })

  return driveFileResponse(asset.driveFileId, asset, req.headers.get("range"), "SHARE")
}
