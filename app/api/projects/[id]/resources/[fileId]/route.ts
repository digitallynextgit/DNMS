import { NextRequest, NextResponse } from "next/server"
import {
  canManageProject,
  resolveProjectId,
  withProjectAccess,
} from "@/features/projects/server/project-access"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/constants"
import { getSignedUrl, deleteFile } from "@/lib/storage"
import { isDocTag, type DocTag } from "@/features/projects/lib/doc-tag"
import { resourcePatchSchema } from "@/features/projects/schemas/files.schema"
import type { Session } from "next-auth"

// GET /api/projects/[id]/resources/[fileId] - returns metadata + signed download URL
export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId, fileId } = ctx.params
      // ?download=1 signs the URL with an attachment Content-Disposition, so the
      // browser saves the file instead of rendering it. Without it a PDF or an
      // image opens inline, which is what "View" wants. One route, two verbs -
      // the alternative is a second endpoint that differs by one boolean.
      const asDownload = new URL(req.url).searchParams.get("download") === "1"
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

      const signedUrl = await getSignedUrl(
        resource.objectKey,
        900, // 15 min
        asDownload ? { downloadFileName: resource.fileName } : undefined,
      )
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
      const { fileId } = ctx.params
      // The URL carries a slug now; this route is behind plain withSession, so
      // resolve it before comparing against the resource's stored projectId.
      const projectId = await resolveProjectId(ctx.params.id)
      if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })

      const resource = await db.projectResource.findUnique({
        where: { id: fileId },
        include: { team: { select: { id: true, managerId: true } } },
      })
      if (!resource || resource.projectId !== projectId) {
        return NextResponse.json({ error: "Resource not found" }, { status: 404 })
      }

      const isUploader = resource.uploadedById === session.user.id
      const isAdmin = await canManageProject(session, projectId)
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

/**
 * PATCH /api/projects/[id]/resources/[fileId] - retag a file.
 *
 * The tag is a GUESS made from the filename on upload (see doc-tag.ts), so it
 * is wrong often enough that it has to be correctable in place - a guess nobody
 * can fix is worse than no guess, because people learn to distrust the column
 * rather than repair it.
 *
 * Same permission set as DELETE, minus the destructiveness: the uploader, the
 * team's manager, or a project manager/admin. Retagging is not a read-only act
 * (it moves a file in everyone else's filter) but it is recoverable, so the
 * check is deliberately no stricter than the one on the file itself.
 */
export const PATCH = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { fileId } = ctx.params
      const projectId = await resolveProjectId(ctx.params.id)
      if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })

      const resource = await db.projectResource.findUnique({
        where: { id: fileId },
        include: { team: { select: { id: true, managerId: true } } },
      })
      if (!resource || resource.projectId !== projectId) {
        return NextResponse.json({ error: "Resource not found" }, { status: 404 })
      }

      const isUploader = resource.uploadedById === session.user.id
      const isAdmin = await canManageProject(session, projectId)
      const isTeamManager = resource.team?.managerId === session.user.id
      if (!isUploader && !isAdmin && !isTeamManager) {
        return NextResponse.json({ error: "You cannot edit this file" }, { status: 403 })
      }

      // Three edits share this route - retag, rename, move - because they share
      // the permission rule above and are all recoverable. `tag: null` is a
      // legal value: it clears the tag back to "never classified", which is
      // distinct from the OTHER tag. `folderId: null` moves to the top level.
      const parsed = resourcePatchSchema.safeParse(await req.json().catch(() => null))
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input" },
          { status: 422 },
        )
      }
      const body = parsed.data
      if (body.folderId) {
        const folder = await db.projectFolder.findFirst({
          where: { id: body.folderId, projectId },
          select: { id: true },
        })
        if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 })
      }
      if (body.tag !== undefined && body.tag !== null && !isDocTag(body.tag)) {
        return NextResponse.json({ error: "Invalid tag" }, { status: 422 })
      }

      const updated = await db.projectResource.update({
        where: { id: fileId },
        data: {
          ...(body.tag !== undefined ? { tag: body.tag as DocTag | null } : {}),
          ...(body.fileName !== undefined ? { fileName: body.fileName } : {}),
          ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
        },
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
          team: { select: { id: true, name: true } },
        },
      })

      await createAuditLog(session, {
        action: "UPDATE",
        module: "project",
        entityType: "ProjectResource",
        entityId: fileId,
        changes: {
          fileName: resource.fileName,
          ...(body.tag !== undefined ? { tag: { from: resource.tag, to: updated.tag } } : {}),
          ...(body.fileName !== undefined ? { renamedTo: updated.fileName } : {}),
          ...(body.folderId !== undefined
            ? { folder: { from: resource.folderId, to: updated.folderId } }
            : {}),
        } as object,
      })

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[RESOURCE_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
