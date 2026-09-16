import { NextRequest, NextResponse } from "next/server"
import { inPublicApiTenant } from "@/server/public-api"
import { db } from "@/server/db"
import { driveFileResponse } from "@/server/drive-stream"

// GET /api/public/share/:token
//
// DELIBERATELY UNAUTHENTICATED, like the mailer-image route beside it. The whole
// point is that a client can send this link to someone with no DNMS account and
// no Google account, and it plays.
//
// ── WHY THIS EXISTS AT ALL ───────────────────────────────────────────────────
// Google Drive would normally do this itself with an "anyone with the link"
// permission. This Workspace refuses that outright (`publishOutNotPermitted`),
// and the only way to change it is an org-wide setting that would publish every
// company file. So the grant lives in our database instead, one token per video.
//
// That trade is not a workaround, it is narrower: the token names exactly one
// file, and clearing the column revokes it instantly - whereas a Drive
// permission granted to "anyone" keeps serving everyone who ever saved the URL.
//
// ── WHAT GUARDS IT ───────────────────────────────────────────────────────────
// The token, and only the token: 192 random bits, matched against a UNIQUE
// column. The lookup requires `is_public_link = true` as well, so revoking by
// either column is enough. The route reads NOTHING from the URL except that
// token - no file id, no project - so it cannot be pointed at another asset.
export const runtime = "nodejs"

// A share link is for watching, so it must stream rather than buffer: a 250 MB
// video read into memory first would sit for a minute and then spike the server.
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  // Cheap shape check before touching the database, so a scanner hitting random
  // paths costs a string comparison rather than a query.
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

  // Revoked, deleted, or never existed all answer the same way. A distinct
  // "revoked" would confirm to whoever holds a dead link that it was once real.
  if (!asset?.driveFileId) return new NextResponse("Not found", { status: 404 })

  return driveFileResponse(asset.driveFileId, asset, req.headers.get("range"), "SHARE")
}
