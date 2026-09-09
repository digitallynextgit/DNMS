import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { createLink, listProjectLinks } from "@/features/projects/server/links.service"
import { linkCreateSchema } from "@/features/projects/schemas/files.schema"
import { createAuditLog } from "@/lib/audit"
import type { DocTag } from "@/features/projects/lib/doc-tag"

// GET /api/projects/[id]/links - every saved link in the project.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    return NextResponse.json({ data: await listProjectLinks(ctx.params.id) })
  },
)

// POST /api/projects/[id]/links  body { title, url, folderId?, tag?, description? }
// Any project member may save a link, like uploading a file.
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const input = linkCreateSchema.parse(await req.json().catch(() => ({})))
    const link = await createLink(session, ctx.params.id, {
      ...input,
      tag: input.tag as DocTag | null,
    })
    await createAuditLog(session, {
      action: "CREATE",
      module: "project",
      entityType: "ProjectLink",
      entityId: link.id,
      changes: { title: link.title, url: link.url, folderId: link.folderId },
    })
    return NextResponse.json({ data: link }, { status: 201 })
  },
)
