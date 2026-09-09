import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { deleteLink, updateLink } from "@/features/projects/server/links.service"
import { linkUpdateSchema } from "@/features/projects/schemas/files.schema"
import { createAuditLog } from "@/lib/audit"
import type { DocTag } from "@/features/projects/lib/doc-tag"

// PATCH /api/projects/[id]/links/[linkId]  body { title?, url?, folderId?, tag?, description? }
// Whoever added the link, or a project manager (enforced in the service).
export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, linkId } = ctx.params
    const input = linkUpdateSchema.parse(await req.json().catch(() => ({})))
    const link = await updateLink(session, projectId, linkId, {
      ...input,
      ...(input.tag !== undefined ? { tag: input.tag as DocTag | null } : {}),
    })
    await createAuditLog(session, {
      action: "UPDATE",
      module: "project",
      entityType: "ProjectLink",
      entityId: linkId,
      changes: input,
    })
    return NextResponse.json({ data: link })
  },
)

// DELETE /api/projects/[id]/links/[linkId]
export const DELETE = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, linkId } = ctx.params
    const link = await deleteLink(session, projectId, linkId)
    await createAuditLog(session, {
      action: "DELETE",
      module: "project",
      entityType: "ProjectLink",
      entityId: linkId,
      changes: { title: link.title, url: link.url },
    })
    return NextResponse.json({ data: { ok: true } })
  },
)
