import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/constants"
import { getSignedUrl, deleteFile } from "@/lib/storage"
import type { Session } from "next-auth"

// GET /api/projects/[id]/resources/[fileId] - returns metadata + signed download URL
export const GET = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId, fileId } = ctx.params
      const resource = await db.projectResource.findUnique({
        where: { id: fileId },
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          team: { select: { id: true, name: true } },
        },
      })
      if (!resource || resource.projectId !== projectId) {
        return NextResponse.json({ error: "Resource not found" }, { status: 404 })
      }

      const signedUrl = await getSignedUrl(resource.objectKey, 900) // 15 min
      return NextResponse.json({ data: { ...resource, signedUrl } })
    } catch (error) {
      console.error("[RESOURCE_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// DELETE /api/projects/[id]/resources/[fileId] - uploader, team manager, or admin
export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, fileId } = ctx.params
      const resource = await db.projectResource.findUnique({
        where: { id: fileId },
        include: { team: { select: { id: true, managerId: true } } },
      })
      if (!resource || resource.projectId !== projectId) {
        return NextResponse.json({ error: "Resource not found" }, { status: 404 })
      }

      const isUploader = resource.uploadedById === session.user.id
      const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
      const isTeamManager = resource.team?.managerId === session.user.id

      if (!isUploader && !isAdmin && !isTeamManager) {
        return NextResponse.json(
          { error: "You can only delete files you uploaded" },
          { status: 403 },
        )
      }

      try {
        await deleteFile(resource.objectKey)
      } catch {
        /* file may already be gone */
      }
      await db.projectResource.delete({ where: { id: fileId } })

      await createAuditLog(session, {
        action: "DELETE",
        module: "project",
        entityType: "ProjectResource",
        entityId: fileId,
        changes: { fileName: resource.fileName, objectKey: resource.objectKey },
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[RESOURCE_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
