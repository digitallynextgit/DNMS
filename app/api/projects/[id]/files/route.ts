import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { getFolderListing, searchRepository } from "@/features/projects/server/files.queries"

// One folder of the Files tree (sub-folders, files, links, Drive files); omit `folder` for the top
// level. With `search`, the whole Repository is searched instead, each hit with its folder path.
export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const params = new URL(req.url).searchParams
    const search = params.get("search")
    if (search !== null) {
      return NextResponse.json({ data: await searchRepository(ctx.params.id, search) })
    }
    const folder = params.get("folder")
    const data = await getFolderListing(ctx.params.id, folder || null, session.user.id)
    return NextResponse.json({ data })
  },
)
