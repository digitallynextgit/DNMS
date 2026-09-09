import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { deleteFolder, moveFolder, renameFolder } from "@/features/projects/server/folders.service"
import { folderUpdateSchema } from "@/features/projects/schemas/files.schema"
import { createAuditLog } from "@/lib/audit"

// PATCH /api/projects/[id]/folders/[folderId]  body { name?, parentId? }
// Rename and/or move. The service enforces creator-or-manager, sibling
// uniqueness and the no-cycle rule, and mirrors the change to Drive.
export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, folderId } = ctx.params
    const input = folderUpdateSchema.parse(await req.json().catch(() => ({})))
    let folder = null
    if (input.parentId !== undefined)
      folder = await moveFolder(session, projectId, folderId, input.parentId)
    if (input.name !== undefined)
      folder = await renameFolder(session, projectId, folderId, input.name)
    await createAuditLog(session, {
      action: "UPDATE",
      module: "project",
      entityType: "ProjectFolder",
      entityId: folderId,
      changes: input,
    })
    return NextResponse.json({ data: folder })
  },
)

// DELETE /api/projects/[id]/folders/[folderId] - only when empty (see service).
export const DELETE = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, folderId } = ctx.params
    const folder = await deleteFolder(session, projectId, folderId)
    await createAuditLog(session, {
      action: "DELETE",
      module: "project",
      entityType: "ProjectFolder",
      entityId: folderId,
      changes: { name: folder.name, driveFolderId: folder.driveFolderId },
    })
    return NextResponse.json({ data: { ok: true } })
  },
)
