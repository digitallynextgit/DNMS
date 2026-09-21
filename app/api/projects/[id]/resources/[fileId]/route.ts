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
import { deleteVideoAsset } from "@/lib/drive-media"
import { syncMadeCount, attachmentCount } from "@/lib/deliverable-counts"
import { isDocTag, type DocTag } from "@/features/projects/lib/doc-tag"
import { resourcePatchSchema } from "@/features/projects/schemas/files.schema"
import { workbookTeamForProject } from "@/features/projects/server/sheets.service"
import { canContributeToWorkbookTeam } from "@/features/projects/server/project-access"
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

      // Drive-hosted (video): Drive's own viewer, which streams rather than
      // making the browser pull the whole file first. No signed url to mint.
      const signedUrl = resource.driveFileId
        ? asDownload
          ? `https://drive.google.com/uc?export=download&id=${resource.driveFileId}`
          : resource.driveWebViewLink
        : await getSignedUrl(
            // Non-null whenever driveFileId is null - the table's CHECK
            // constraint gives every row exactly one store.
            resource.objectKey!,
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
        // A Drive video must be UN-PUBLISHED, not just trashed: dropping the row
        // leaves Drive still serving the public link to everyone who saved it,
        // with nothing in this app left pointing at it.
        if (resource.driveFileId) await deleteVideoAsset(resource.driveFileId)
        else await deleteFile(resource.objectKey!)
      } catch {
        /* file may already be gone */
      }
      await db.projectResource.delete({ where: { id: fileId } })

      // One fewer thing handed over, so Made follows it down - unless the count
      // was already running ahead of the attachments, which syncMadeCount
      // leaves alone. Read AFTER the delete, so `before` is one more.
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
      // Retag, rename and move are recoverable and open to the uploader. SHARING
      // is not in that class - it is the only field here that changes who
      // outside the company can see the file - so it takes the project-manager
      // permission rather than "I uploaded it".
      // A review decision is a project-manager act too: it is what releases a
      // client's asset as accepted, and it is recorded against whoever made it.
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
      // ATTACHING needs permission on the target row; DETACHING (null) does
      // not, because it takes nothing away from anyone - the file stays in the
      // project's Files, and whoever may edit this file may tidy up its links.
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

      const updated = await db.projectResource.update({
        where: { id: fileId },
        data: {
          ...(body.tag !== undefined ? { tag: body.tag as DocTag | null } : {}),
          ...(body.fileName !== undefined ? { fileName: body.fileName } : {}),
          ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
          ...(body.workbookTeamId !== undefined ? { workbookTeamId: body.workbookTeamId } : {}),
          // Sharing opens the review loop; unsharing closes it and clears the
          // decision, because an approval of a file nobody can see any more is
          // not a fact worth keeping. The table's CHECK constraint refuses a
          // review status on an unshared row, so these move together or not at all.
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
          // Logged loudly: this is the field that exposes a file to people
          // outside the company.
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
