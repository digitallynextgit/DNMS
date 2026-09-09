import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { createFolder, listProjectFolders } from "@/features/projects/server/folders.service"
import { folderCreateSchema } from "@/features/projects/schemas/files.schema"
import { createAuditLog } from "@/lib/audit"

// GET /api/projects/[id]/folders - every folder in the project (flat; the
// client builds the tree). Used by "Move to..." pickers.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    return NextResponse.json({ data: await listProjectFolders(ctx.params.id) })
  },
)

// POST /api/projects/[id]/folders  body { name, parentId? }
// Any project member may make a folder - the same people who may upload into it.
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const input = folderCreateSchema.parse(await req.json().catch(() => ({})))
    const folder = await createFolder(session, ctx.params.id, input)
    await createAuditLog(session, {
      action: "CREATE",
      module: "project",
      entityType: "ProjectFolder",
      entityId: folder.id,
      changes: { name: folder.name, parentId: folder.parentId },
    })
    return NextResponse.json({ data: folder }, { status: 201 })
  },
)
