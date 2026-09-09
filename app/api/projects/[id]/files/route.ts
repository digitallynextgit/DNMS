import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { getFolderListing } from "@/features/projects/server/files.queries"

// GET /api/projects/[id]/files?folder=<folderId>
// One folder of the project's Files tree: sub-folders, Backblaze files, links
// and the mirrored Drive folder's files, in a single round trip. Omit `folder`
// for the top level. Any project member may read (withProjectAccess); thrown
// AppErrors (unknown folder → 404) are mapped by withSession's error funnel.
export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const folder = new URL(req.url).searchParams.get("folder")
    const data = await getFolderListing(ctx.params.id, folder || null, session.user.id)
    return NextResponse.json({ data })
  },
)
