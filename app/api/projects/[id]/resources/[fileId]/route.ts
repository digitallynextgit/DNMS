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
import { syncMadeCount, attachmentCount } from "@/lib/deliverable-counts"
import {
  removeRepositoryObject,
  repositoryFileUrl,
} from "@/features/projects/server/repository-files"
import {
  moveProjectDriveFile,
  renameProjectDriveFile,
} from "@/features/projects/server/project-drive.service"
import { isDocTag, type DocTag } from "@/features/projects/lib/doc-tag"
import { resourcePatchSchema } from "@/features/projects/schemas/files.schema"
import { workbookTeamForProject } from "@/features/projects/server/sheets.service"
import { canContributeToWorkbookTeam } from "@/features/projects/server/project-access"
import type { Session } from "next-auth"

export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId, fileId } = ctx.params
      // ?download=1 signs with an attachment disposition; without it PDFs/images open inline (View).
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

      // Drive files stream through DNMS; Backblaze ones get a 15-minute signed URL.
      const signedUrl = await repositoryFileUrl(resource, { download: asDownload })
      return NextResponse.json({ data: { ...resource, signedUrl } })
    } catch (error) {
      console.error("[RESOURCE_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// Uploader, team manager, or admin.
export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { fileId } = ctx.params
      // Plain withSession, so resolve the slug before comparing with the stored projectId.
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
        // Un-publish Drive files, not just drop the row, or Drive keeps serving a public link.
        await removeRepositoryObject(resource)
      } catch {
        /* file may already be gone */
      }
      await db.projectResource.delete({ where: { id: fileId } })

      // Made follows the attachment count down (syncMadeCount leaves a count running ahead alone).
      if (resource.deliverableId) {
        const entry = await db.projectDeliverable.findUnique({
          where: { id: resource.deliverableId },
          select: { id: true, quantity: true },
        })
        if (entry) {
          const after = await attachmentCount(resource.deliverableId)
          await syncMadeCount(entry, after + 1, after)
        }
      }

      await createAuditLog(session, {
        action: "DELETE",
        module: "project",
        entityType: "ProjectResource",
        entityId: fileId,
        changes: {
          fileName: resource.fileName,
          objectKey: resource.objectKey,
          driveFileId: resource.driveFileId,
        },
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[RESOURCE_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// The tag is a filename guess on upload, so it must be correctable. Same people as DELETE: the
// uploader, the team's manager, or a project manager/admin.
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

      // Retag, rename and move share this route. `tag: null` clears to "never classified" (not OTHER);
      // `folderId: null` moves to the top level.
      const parsed = resourcePatchSchema.safeParse(await req.json().catch(() => null))
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input" },
          { status: 422 },
        )
      }
      const body = parsed.data
      // Sharing (who outside the company sees the file) and review decisions are project-manager acts.
      if (body.reviewStatus !== undefined && !isAdmin) {
        return NextResponse.json(
          { error: "Only a project manager can review a client file" },
          { status: 403 },
        )
      }
      if (body.reviewStatus !== undefined && !resource.isClientVisible) {
        return NextResponse.json(
          { error: "Share the file with the client before reviewing it" },
          { status: 409 },
        )
      }
      if (body.isClientVisible !== undefined && !isAdmin) {
        return NextResponse.json(
          { error: "Only a project manager can share a file with the client" },
          { status: 403 },
        )
      }
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
      // Attaching needs permission on the target row; detaching doesn't (it takes nothing away).
      if (body.workbookTeamId) {
        const row = await workbookTeamForProject(body.workbookTeamId, projectId)
        if (!row) {
          return NextResponse.json(
            { error: "Calendar row not found in this project" },
            { status: 404 },
          )
        }
        if (!(await canContributeToWorkbookTeam(session, projectId, row.workbookId, row.teamId))) {
          return NextResponse.json(
            { error: "Only somebody on that team can attach files to its row" },
            { status: 403 },
          )
        }
      }

      // A Drive file follows its row, so the project's Drive folder reads the same as the Repository.
      if (resource.driveFileId) {
        try {
          if (body.fileName !== undefined && body.fileName !== resource.fileName)
            await renameProjectDriveFile(projectId, resource.driveFileId, body.fileName)
          if (body.folderId !== undefined && body.folderId !== resource.folderId)
            await moveProjectDriveFile(projectId, resource.driveFileId, body.folderId)
        } catch (e) {
          console.error("[RESOURCE_PATCH] Drive rename/move failed", fileId, e)
        }
      }

      const updated = await db.projectResource.update({
        where: { id: fileId },
        data: {
          ...(body.tag !== undefined ? { tag: body.tag as DocTag | null } : {}),
          ...(body.fileName !== undefined ? { fileName: body.fileName } : {}),
          ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
          ...(body.workbookTeamId !== undefined ? { workbookTeamId: body.workbookTeamId } : {}),
          // Sharing opens the review loop; unsharing clears the decision (a CHECK constraint ties them).
          ...(body.isClientVisible === true
            ? {
                isClientVisible: true,
                sharedAt: resource.sharedAt ?? new Date(),
                reviewStatus: resource.reviewStatus ?? ("IN_REVIEW" as const),
              }
            : {}),
          ...(body.reviewStatus !== undefined
            ? {
                reviewStatus: body.reviewStatus,
                reviewedAt: new Date(),
                // The staff column, not the client one - see the schema note.
                reviewedById: session.user.id,
                reviewedByClientId: null,
                reviewNote: body.reviewNote || null,
              }
            : {}),
          ...(body.isClientVisible === false
            ? {
                isClientVisible: false,
                reviewStatus: null,
                reviewedAt: null,
                reviewedByClientId: null,
                reviewNote: null,
              }
            : {}),
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
          ...(body.reviewStatus !== undefined
            ? { review: { from: resource.reviewStatus, to: body.reviewStatus } }
            : {}),
          ...(body.isClientVisible !== undefined
            ? {
                sharedWithClient: {
                  from: resource.isClientVisible,
                  to: updated.isClientVisible,
                },
              }
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
