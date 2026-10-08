import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { getFolderListing } from "@/features/projects/server/files.queries"

// One folder of the Files tree (sub-folders, files, links, Drive files); omit `folder` for the top level.
export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const folder = new URL(req.url).searchParams.get("folder")
    const data = await getFolderListing(ctx.params.id, folder || null, session.user.id)
    return NextResponse.json({ data })
  },
)
