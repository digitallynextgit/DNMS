import "server-only"

import { db } from "@/server/db"
import { requireClientModule } from "@/server/client-guard"
import { recordActivity } from "@/lib/activity"
import { createNotifications } from "@/lib/notifications"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { getObjectKey, uploadFile, getSignedUrl, deleteFile, isB2Configured } from "@/lib/storage"
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from "@/lib/constants"

// =============================================================================
// Documents & assets, from the CLIENT side.
// =============================================================================
// A shared library, and only that: what the team published, plus whatever the
// client sent back. The approve / request-changes loop that used to live here
// has moved to the content plan, where a decision attaches to the thing that
// was actually commissioned rather than to a loose file. Two review surfaces
// asking the same question in different words was one too many.
//
// `reviewStatus` is still SET on a client upload - it is the TEAM's queue, and
// the project Files tab reads it. It is simply no longer the client's to move.
// The portal reads the same project_resources table staff use, which is exactly
// why every query here is filtered on `isClientVisible: true`. That flag
// defaults to false, so a file reaches an outsider only because a staff member
// deliberately shared it - an internal brief sitting in the same folder is
// invisible here by construction, not by remembering to exclude it.
//
// Every recordActivity call passes the SESSION, never null: it dispatches on
// the actor, and a null session is read as staff - which sent every client
// action to audit_logs (whose actor_id is an employees foreign key, so it
// landed with no actor at all) and wrote nothing to the client's own Activity
// tab. Pass the session; the routing is its job.
//
// Every entry point starts with requireClientModule(projectRef, "documents"),
// which re-proves the session, the grant and the module. The projectRef in the
// URL is a lookup key, never an authorisation.
// =============================================================================

/** What the portal is allowed to know about a file. No object keys, no internals. */
const PORTAL_FILE_SELECT = {
  id: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  description: true,
  category: true,
  folderId: true,
  createdAt: true,
  sharedAt: true,
  uploadedBy: { select: { firstName: true, lastName: true } },
  uploadedByClient: { select: { id: true, name: true } },
} as const

/** The shared library for one project: folders that contain shared files, and the files. */
export async function listClientDocuments(projectRef: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { grant } = await requireClientModule(projectRef, "documents")

    const files = await db.projectResource.findMany({
      where: { projectId: grant.projectId, isClientVisible: true },
      select: PORTAL_FILE_SELECT,
      orderBy: [{ createdAt: "desc" }],
    })

    // Only folders that actually contain something shared. Listing the whole
    // tree would leak the project's internal structure - folder names alone say
    // a lot about work an outsider has no business seeing.
    const folderIds = [...new Set(files.map((f) => f.folderId).filter((id): id is string => !!id))]
    const folders = folderIds.length
      ? await db.projectFolder.findMany({
          where: { id: { in: folderIds }, projectId: grant.projectId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : []

    return ok(serialize({ data: { files, folders, projectName: grant.projectName } }))
  })
}

/** A short-lived signed URL for one shared file. */
export async function getClientDocumentUrl(
  projectRef: string,
  fileId: string,
  opts: { download?: boolean } = {},
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "documents")

    // projectId AND isClientVisible, both: an id from another project, or an
    // unshared file in this one, must be indistinguishable from one that does
    // not exist.
    const file = await db.projectResource.findFirst({
      where: { id: fileId, projectId: grant.projectId, isClientVisible: true },
      select: { id: true, objectKey: true, fileName: true },
    })
    if (!file) return fail("File not found", undefined, 404)
    if (!isB2Configured()) return fail("File storage is not configured", undefined, 503)

    const url = await getSignedUrl(file.objectKey, 3600, {
      downloadFileName: opts.download ? file.fileName : undefined,
    })

    await recordActivity(session, {
      action: "portal_document:download",
      module: "project",
      entityType: "ProjectResource",
      entityId: file.id,
      summary: `Opened "${file.fileName}"`,
      projectId: grant.projectId,
    })

    return ok(serialize({ data: { url, fileName: file.fileName } }))
  })
}

/**
 * A file uploaded FROM the portal.
 *
 * Lands shared and IN_REVIEW: the client put it there for the team to look at,
 * so hiding it would be pointless and marking it approved would let one side
 * approve its own submission.
 */
export async function uploadClientDocument(
  projectRef: string,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "documents")
    if (!isB2Configured()) return fail("File storage is not configured", undefined, 503)

    const file = formData.get("file")
    if (!(file instanceof File)) return fail("Choose a file to upload", undefined, 400)
    if (file.size === 0) return fail("That file is empty", undefined, 400)
    if (file.size > MAX_FILE_SIZE) {
      return fail(
        `Files must be under ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)} MB`,
        undefined,
        413,
      )
    }
    if (file.type && !ALLOWED_FILE_TYPES.includes(file.type)) {
      return fail("That file type is not accepted", undefined, 415)
    }

    const description =
      String(formData.get("description") ?? "")
        .trim()
        .slice(0, 300) || null

    const id = crypto.randomUUID()
    const objectKey = getObjectKey(`project-resources/${grant.projectId}`, file.name, id)
    await uploadFile(objectKey, Buffer.from(await file.arrayBuffer()), file.type)

    const created = await db.projectResource.create({
      data: {
        id,
        projectId: grant.projectId,
        category: "ASSETS",
        fileName: file.name.slice(0, 200),
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        objectKey,
        description,
        // The client is the uploader - uploadedById stays null. The CHECK
        // constraint on the table enforces exactly one of the two.
        uploadedById: null,
        uploadedByClientId: session.user.id,
        isClientVisible: true,
        sharedAt: new Date(),
        reviewStatus: "IN_REVIEW",
      },
      select: { id: true, fileName: true },
    })

    // Tell the team. A file that arrives silently is a file nobody looks at.
    const staff = await db.projectTeam.findMany({
      where: { projectId: grant.projectId, managerId: { not: null } },
      select: { managerId: true },
    })
    const owner = await db.project.findUnique({
      where: { id: grant.projectId },
      select: { ownerId: true, slug: true },
    })
    const recipients = [
      ...new Set(
        [...staff.map((t) => t.managerId), owner?.ownerId].filter((v): v is string => !!v),
      ),
    ]
    if (recipients.length > 0) {
      await createNotifications(
        recipients.map((employeeId) => ({
          employeeId,
          title: "Client uploaded a file",
          message: `${session.user.name ?? "A client"} uploaded "${created.fileName}" to ${grant.projectName}.`,
          type: "info" as const,
          link: `/projects/${owner?.slug ?? grant.projectId}`,
        })),
      )
    }

    await recordActivity(session, {
      action: "portal_document:upload",
      module: "project",
      entityType: "ProjectResource",
      entityId: created.id,
      summary: `Uploaded "${created.fileName}"`,
      projectId: grant.projectId,
      changes: { fileSize: file.size },
    })

    return ok(serialize({ data: { id: created.id } }))
  })
}

/** Remove a file the client uploaded themselves, and only that. */
export async function deleteClientDocument(
  projectRef: string,
  fileId: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "documents")

    const file = await db.projectResource.findFirst({
      where: { id: fileId, projectId: grant.projectId, uploadedByClientId: session.user.id },
      select: { id: true, objectKey: true, fileName: true, reviewStatus: true },
    })
    // Deliberately narrow: a client may withdraw their OWN upload and nothing
    // else. A staff-published document is not theirs to remove.
    if (!file) return fail("File not found", undefined, 404)
    if (file.reviewStatus === "APPROVED") {
      return fail("That file has been approved and can no longer be withdrawn", undefined, 409)
    }

    await db.projectResource.delete({ where: { id: file.id } })
    try {
      await deleteFile(file.objectKey)
    } catch (e) {
      // The row is gone; an orphaned object is a storage-cleanup problem, not a
      // reason to fail the request the person already saw succeed.
      console.error("[portal] object delete failed", file.objectKey, e)
    }

    await recordActivity(session, {
      action: "portal_document:withdraw",
      module: "project",
      entityType: "ProjectResource",
      entityId: fileId,
      summary: `Withdrew "${file.fileName}"`,
      projectId: grant.projectId,
    })

    return ok(serialize({ data: { id: fileId } }))
  })
}
