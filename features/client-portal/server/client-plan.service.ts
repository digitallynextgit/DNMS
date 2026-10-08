import "server-only"

import { db } from "@/server/db"
import { requireClientModule } from "@/server/client-guard"
import { recordActivity } from "@/lib/activity"
import { createNotifications } from "@/lib/notifications"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { getObjectKey, uploadFile, getSignedUrl, deleteFile, isB2Configured } from "@/lib/storage"
import {
  uploadVideoAsset,
  deleteVideoAsset,
  VideoUploadError,
  shareUrlFor,
} from "@/lib/drive-media"
import { isVideoUpload, isAllowedDocument } from "@/lib/upload-rules"
import { syncMadeCount, attachmentCount } from "@/lib/deliverable-counts"
import { MAX_FILE_SIZE } from "@/lib/constants"
import {
  allowedTransition,
  DELIVERABLE_STATUS_LABELS,
} from "@/features/projects/lib/deliverable-lifecycle"
import { todayUtc } from "@/lib/dates"
import { periodProblem } from "@/features/projects/lib/delivery-period"
import { cleanType, MAX_LINKS } from "@/features/projects/lib/deliverable-types"
import { isSafeHttpUrl } from "@/features/projects/lib/task-links"
import { mayWithdraw } from "../lib/plan-rules"
import {
  clientPlanCreateSchema,
  clientPlanStatusSchema,
  clientPlanLinkSchema,
  type ClientPlanCreateInput,
  type ClientPlanStatusInput,
  type ClientPlanLinkInput,
} from "../schemas/plan.schema"

// The client's view of the deliverables board. projectRef is only a lookup key;
// every query filters on grant.projectId.

/** What the portal may see of one item: never hours, maker, QC, source task or team. */
const PORTAL_ITEM_SELECT = {
  id: true,
  type: true,
  title: true,
  quantity: true,
  deliveredQuantity: true,
  status: true,
  dueOn: true,
  periodStart: true,
  periodEnd: true,
  completedOn: true,
  links: true,
  statusReason: true,
  acceptedAt: true,
  acceptanceNote: true,
  createdAt: true,
  loggedByClient: { select: { id: true, name: true } },
  // Read, but NEVER returned as-is: see the mapping below.
  notes: true,
  loggedById: true,
  loggedByClientId: true,
  acceptedByClient: { select: { id: true, name: true } },
  files: {
    // Only client-shared files - a deliverable can carry internal ones too.
    where: { isClientVisible: true },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      // Used to build the share url, never returned. driveWebViewLink is internal-only.
      shareToken: true,
      isPublicLink: true,
      // Becomes `isMine`: the same check the delete endpoint makes.
      uploadedByClientId: true,
    },
  },
} as const

/** A DATE column as "yyyy-MM-dd": the browser date helpers append their own time part. */
const asDay = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null)

/** The plan for one project: every item, and whether planning is possible yet. */
export async function listClientPlan(projectRef: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "plan")

    const [rows, teamCount] = await Promise.all([
      db.projectDeliverable.findMany({
        where: { projectId: grant.projectId },
        select: PORTAL_ITEM_SELECT,
        orderBy: [{ periodStart: "desc" }, { dueOn: "asc" }, { createdAt: "asc" }],
      }),
      db.projectTeam.count({ where: { projectId: grant.projectId } }),
    ])

    // `notes` is internal except on rows the client wrote, so it never leaves under its own name.
    const items = rows.map(({ notes, loggedById, loggedByClientId, ...row }) => ({
      ...row,
      // Same for shareToken: only the finished url goes out.
      files: row.files.map(({ shareToken, uploadedByClientId, ...f }) => ({
        ...f,
        shareUrl: shareToken ? shareUrlFor(shareToken) : null,
        isMine: uploadedByClientId === session.user.id,
      })),
      attached: row.files.length + row.links.length,
      dueOn: asDay(row.dueOn),
      periodStart: asDay(row.periodStart),
      periodEnd: asDay(row.periodEnd),
      completedOn: asDay(row.completedOn),
      yourBrief: !loggedById && row.loggedByClient ? notes : null,
      canWithdraw: mayWithdraw(
        { loggedById, loggedByClientId, status: row.status },
        session.user.id,
      ),
    }))

    // Period grouping happens in the browser, with the helper the staff board uses.
    return ok(
      serialize({
        data: { items, canPlan: teamCount > 0, projectName: grant.projectName },
      }),
    )
  })
}

/** The staff who should hear about something the client just did. */
async function projectWatchers(projectId: string): Promise<string[]> {
  const [teams, project] = await Promise.all([
    db.projectTeam.findMany({
      where: { projectId, managerId: { not: null } },
      select: { managerId: true },
    }),
    db.project.findUnique({ where: { id: projectId }, select: { ownerId: true } }),
  ])
  return [
    ...new Set(
      [...teams.map((t) => t.managerId), project?.ownerId].filter((v): v is string => !!v),
    ),
  ]
}

async function projectSlug(projectId: string): Promise<string> {
  const p = await db.project.findUnique({ where: { id: projectId }, select: { slug: true } })
  return p?.slug ?? projectId
}

/**
 * Team a client-planned row is filed under until the AM routes it - the DB check needs a
 * team on unassigned rows. ADMIN if the project has one, else the first team.
 */
async function intakeTeamId(projectId: string): Promise<string | null> {
  const teams = await db.projectTeam.findMany({
    where: { projectId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  const admin = teams.find((t) => t.name.trim().toUpperCase() === "ADMIN")
  return admin?.id ?? teams[0]?.id ?? null
}

/** Client plans a period. Rows land PLANNED and unassigned; the AM picks the team. */
export async function createClientPlanLines(
  projectRef: string,
  body: ClientPlanCreateInput,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "plan")
    const input = clientPlanCreateSchema.parse(body)

    const start = new Date(`${input.periodStart}T00:00:00.000Z`)
    const end = new Date(`${input.periodEnd}T00:00:00.000Z`)
    const problem = periodProblem(start, end)
    if (problem) return fail(problem, undefined, 422)

    const teamId = await intakeTeamId(grant.projectId)
    if (!teamId) {
      // No team to file the row under, and the CHECK constraint would refuse it.
      return fail(
        "This project is not set up for planning yet - your account manager can sort that out.",
        undefined,
        409,
      )
    }

    // Case-insensitive, so "reel" doesn't split from the team's "Reel".
    const existingTypes = await db.projectDeliverable.findMany({
      where: { projectId: grant.projectId },
      select: { type: true },
      distinct: ["type"],
    })
    const canonical = (raw: string) => {
      const cleaned = cleanType(raw)
      const match = existingTypes.find((t) => t.type.toLowerCase() === cleaned.toLowerCase())
      return match?.type ?? cleaned
    }

    const rows = input.lines.map((l) => ({
      projectId: grant.projectId,
      teamId,
      employeeId: null,
      // loggedById is an employee FK, so the client author goes in loggedByClientId.
      loggedById: null,
      loggedByClientId: session.user.id,
      type: canonical(l.type),
      title: l.title,
      quantity: l.quantity,
      // The brief goes in `notes`, which the staff board already shows.
      notes: l.description?.trim() || null,
      status: "PLANNED" as const,
      dueOn: end,
      periodStart: start,
      periodEnd: end,
    }))

    const created = await db.$transaction(async (tx) => {
      const made = await tx.projectDeliverable.createManyAndReturn({
        data: rows,
        select: { id: true },
      })
      await tx.projectDeliverableEvent.createMany({
        data: made.map((r) => ({
          deliverableId: r.id,
          type: "CREATED" as const,
          toStatus: "PLANNED" as const,
          // actorId is an Employee foreign key; a client goes in its own column.
          actorClientId: session.user.id,
        })),
      })
      return made.length
    })

    const watchers = await projectWatchers(grant.projectId)
    if (watchers.length > 0) {
      const slug = await projectSlug(grant.projectId)
      await createNotifications(
        watchers.map((employeeId) => ({
          employeeId,
          title: "Client added to the plan",
          message: `${session.user.name ?? "A client"} planned ${created} item${
            created === 1 ? "" : "s"
          } on ${grant.projectName}.`,
          type: "info" as const,
          link: `/projects/${slug}`,
        })),
      )
    }

    await recordActivity(session, {
      action: "content_plan:create",
      module: "project",
      entityType: "ProjectDeliverable",
      summary: `Planned ${created} item${created === 1 ? "" : "s"} for ${input.periodStart} to ${input.periodEnd}`,
      projectId: grant.projectId,
      changes: { lines: created, from: input.periodStart, to: input.periodEnd },
    })

    return ok(serialize({ data: { created } }))
  })
}

/**
 * Signed URL for a plan asset: on this project, shared with the client, and attached to a
 * deliverable (so Documents files aren't reachable through "plan").
 */
export async function getClientPlanAssetUrl(
  projectRef: string,
  fileId: string,
  opts: { download?: boolean } = {},
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "plan")

    const file = await db.projectResource.findFirst({
      where: {
        id: fileId,
        projectId: grant.projectId,
        isClientVisible: true,
        deliverableId: { not: null },
      },
      select: {
        id: true,
        objectKey: true,
        fileName: true,
        driveFileId: true,
        driveWebViewLink: true,
      },
    })
    // Same answer for another project's id, an unshared file, or a non-plan asset.
    if (!file) return fail("File not found", undefined, 404)

    // Drive video goes through our authenticated stream route - the client has no Drive access.
    let url: string
    if (file.driveFileId) {
      url = `/api/portal/projects/${projectRef}/plan/assets/${file.id}/stream`
    } else {
      if (!isB2Configured()) return fail("File storage is not configured", undefined, 503)
      // CHECK constraint: no objectKey means Drive-hosted, handled above.
      url = await getSignedUrl(file.objectKey!, 3600, {
        downloadFileName: opts.download ? file.fileName : undefined,
      })
    }

    await recordActivity(session, {
      action: opts.download ? "content_plan:download" : "content_plan:view",
      module: "project",
      entityType: "ProjectResource",
      entityId: file.id,
      summary: `${opts.download ? "Downloaded" : "Opened"} "${file.fileName}"`,
      projectId: grant.projectId,
    })

    return ok(serialize({ data: { url, fileName: file.fileName } }))
  })
}

/** One item, proved to belong to this client's project. */
async function findItem(projectId: string, deliverableId: string) {
  return db.projectDeliverable.findFirst({
    where: { id: deliverableId, projectId },
    select: {
      id: true,
      title: true,
      status: true,
      links: true,
      quantity: true,
      loggedById: true,
      loggedByClientId: true,
      _count: { select: { files: { where: { isClientVisible: true } } } },
    },
  })
}

/** Attachments used vs planned - files and links count together. */
function capacity(item: { quantity: number; links: string[]; _count: { files: number } }) {
  const used = item._count.files + item.links.length
  return { used, limit: item.quantity, full: used >= item.quantity }
}

/**
 * Delete the client's own upload, in any review state. A shared video's public link is revoked too.
 */
export async function deleteClientPlanAsset(
  projectRef: string,
  fileId: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "plan")

    const file = await db.projectResource.findFirst({
      where: {
        id: fileId,
        projectId: grant.projectId,
        deliverableId: { not: null },
        uploadedByClientId: session.user.id,
      },
      select: {
        id: true,
        fileName: true,
        objectKey: true,
        driveFileId: true,
        deliverableId: true,
        deliverable: { select: { id: true, title: true, quantity: true } },
      },
    })
    // Someone else's upload reads exactly like one that does not exist.
    if (!file) return fail("File not found", undefined, 404)

    // Row first: an orphaned object is only cleanup; a row with no bytes is a dead link.
    await db.projectResource.delete({ where: { id: file.id } })
    try {
      if (file.driveFileId) await deleteVideoAsset(file.driveFileId)
      else if (file.objectKey) await deleteFile(file.objectKey)
    } catch (e) {
      console.error("[portal] asset object delete failed", file.objectKey ?? file.driveFileId, e)
    }

    if (file.deliverable) {
      // Read after the delete. syncMadeCount won't lower a count staff set above the attachments.
      const attachedAfter = await attachmentCount(file.deliverable.id)
      await syncMadeCount(file.deliverable, attachedAfter + 1, attachedAfter)

      await db.projectDeliverableEvent.create({
        data: {
          deliverableId: file.deliverable.id,
          type: "EDITED",
          changes: { fileRemoved: file.fileName },
          actorClientId: session.user.id,
        },
      })
    }

    await recordActivity(session, {
      action: "content_plan:delete_file",
      module: "project",
      entityType: "ProjectResource",
      entityId: file.id,
      summary: `Removed "${file.fileName}" from "${file.deliverable?.title ?? "an item"}"`,
      projectId: grant.projectId,
    })

    return ok(serialize({ data: { id: file.id } }))
  })
}

/** Withdraw a video's public share link (the video itself stays). Idempotent. */
export async function revokeClientPlanShare(
  projectRef: string,
  fileId: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "plan")

    const file = await db.projectResource.findFirst({
      where: {
        id: fileId,
        projectId: grant.projectId,
        isClientVisible: true,
        deliverableId: { not: null },
      },
      select: { id: true, fileName: true, isPublicLink: true },
    })
    if (!file) return fail("File not found", undefined, 404)

    if (file.isPublicLink) {
      // Both columns together - the CHECK constraint requires them to agree.
      await db.projectResource.update({
        where: { id: file.id },
        data: { shareToken: null, isPublicLink: false, sharedPubliclyAt: null },
      })
      await recordActivity(session, {
        action: "content_plan:revoke_share",
        module: "project",
        entityType: "ProjectResource",
        entityId: file.id,
        summary: `Revoked the share link for "${file.fileName}"`,
        projectId: grant.projectId,
      })
    }

    return ok(serialize({ data: { id: file.id, isPublicLink: false } }))
  })
}

export async function attachClientPlanLink(
  projectRef: string,
  deliverableId: string,
  body: ClientPlanLinkInput,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "plan")
    const input = clientPlanLinkSchema.parse(body)

    if (!isSafeHttpUrl(input.link)) {
      return fail("That link must start with http:// or https://", undefined, 422)
    }

    const item = await findItem(grant.projectId, deliverableId)
    if (!item) return fail("Item not found", undefined, 404)
    if (item.status === "ACCEPTED") {
      return fail("That item is finalised - ask the team to re-open it first.", undefined, 409)
    }
    if (item.links.includes(input.link)) {
      return ok(serialize({ data: { id: item.id, links: item.links } }))
    }
    const cap = capacity(item)
    if (cap.full) {
      return fail(
        `"${item.title}" was planned for ${cap.limit}, and ${cap.used} ${cap.used === 1 ? "is" : "are"} already attached. Remove one first, or ask the team to raise the quantity.`,
        undefined,
        422,
      )
    }
    // Hard ceiling, for when someone plans a quantity of 500.
    if (item.links.length >= MAX_LINKS) {
      return fail(`An item holds at most ${MAX_LINKS} links.`, undefined, 422)
    }

    const links = [...item.links, input.link]
    await db.projectDeliverable.update({ where: { id: item.id }, data: { links } })
    // A link counts toward Made just like a file.
    const attachedAfter = await attachmentCount(item.id)
    await syncMadeCount(item, attachedAfter - 1, attachedAfter)
    await db.projectDeliverableEvent.create({
      data: {
        deliverableId: item.id,
        type: "EDITED",
        changes: { links: [item.links, links] },
        actorClientId: session.user.id,
      },
    })

    await recordActivity(session, {
      action: "content_plan:attach_link",
      module: "project",
      entityType: "ProjectDeliverable",
      entityId: item.id,
      summary: `Attached a link to "${item.title}"`,
      projectId: grant.projectId,
      changes: { link: input.link },
    })

    return ok(serialize({ data: { id: item.id, links } }))
  })
}

/** Upload against an item. Lands shared and IN_REVIEW, so the client can't approve it. */
export async function uploadClientPlanFile(
  projectRef: string,
  deliverableId: string,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "plan")

    const item = await findItem(grant.projectId, deliverableId)
    if (!item) return fail("Item not found", undefined, 404)
    if (item.status === "ACCEPTED") {
      return fail("That item is finalised - ask the team to re-open it first.", undefined, 409)
    }

    const file = formData.get("file")
    if (!(file instanceof File)) return fail("Choose a file to upload", undefined, 400)
    if (file.size === 0) return fail("That file is empty", undefined, 400)

    // Checked before the bytes move, not after pushing 200 MB to Drive.
    const cap = capacity(item)
    if (cap.full) {
      return fail(
        `"${item.title}" was planned for ${cap.limit}, and ${cap.used} ${cap.used === 1 ? "is" : "are"} already attached. Remove one first, or ask the team to raise the quantity.`,
        undefined,
        422,
      )
    }

    const id = crypto.randomUUID()
    const fileName = file.name.slice(0, 200)

    // Video goes to Drive: too big for the cap below, and meant to be shareable.
    const video = isVideoUpload(file)

    let stored: {
      objectKey: string | null
      driveFileId: string | null
      driveWebViewLink: string | null
      isPublicLink: boolean
      shareToken: string | null
      sharedPubliclyAt: Date | null
      mimeType: string
    }
    let undoUpload: () => Promise<void>

    if (video) {
      let uploaded
      try {
        uploaded = await uploadVideoAsset(grant.projectId, file)
      } catch (e) {
        // Size / not-configured are the user's to fix, so a message rather than a 500.
        if (e instanceof VideoUploadError) return fail(e.message, undefined, e.status)
        throw e
      }
      stored = {
        objectKey: null,
        driveFileId: uploaded.driveFileId,
        driveWebViewLink: uploaded.webViewLink,
        // Shared on upload; revocable per file.
        isPublicLink: true,
        shareToken: uploaded.shareToken,
        sharedPubliclyAt: new Date(),
        mimeType: uploaded.mimeType,
      }
      undoUpload = () => deleteVideoAsset(uploaded.driveFileId)
    } else {
      if (!isB2Configured()) return fail("File storage is not configured", undefined, 503)
      if (file.size > MAX_FILE_SIZE) {
        return fail(
          `Files must be under ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)} MB`,
          undefined,
          413,
        )
      }
      // Also checks the extension, so files with no MIME type aren't waved through.
      if (!isAllowedDocument(file)) {
        return fail("That file type is not accepted", undefined, 415)
      }
      const objectKey = getObjectKey(`project-resources/${grant.projectId}`, file.name, id)
      await uploadFile(objectKey, Buffer.from(await file.arrayBuffer()), file.type)
      stored = {
        objectKey,
        driveFileId: null,
        driveWebViewLink: null,
        isPublicLink: false,
        shareToken: null,
        sharedPubliclyAt: null,
        mimeType: file.type || "application/octet-stream",
      }
      undoUpload = () => deleteFile(objectKey)
    }

    try {
      await db.projectResource.create({
        data: {
          id,
          projectId: grant.projectId,
          deliverableId: item.id,
          category: "ASSETS",
          fileName,
          fileSize: file.size,
          ...stored,
          // The client is the uploader; the CHECK constraint allows only one of the two.
          uploadedById: null,
          uploadedByClientId: session.user.id,
          isClientVisible: true,
          sharedAt: new Date(),
          reviewStatus: "IN_REVIEW",
        },
        select: { id: true },
      })
    } catch (e) {
      // Don't leave an orphaned object (or a published video nobody can un-publish).
      await undoUpload().catch(() => {})
      throw e
    }

    // From the table: `cap.used` sees only client-visible files; Made counts internal ones too.
    const attachedAfter = await attachmentCount(item.id)
    await syncMadeCount(item, attachedAfter - 1, attachedAfter)

    await db.projectDeliverableEvent.create({
      data: {
        deliverableId: item.id,
        type: "EDITED",
        changes: { fileAdded: fileName },
        actorClientId: session.user.id,
      },
    })

    await recordActivity(session, {
      action: "content_plan:attach_file",
      module: "project",
      entityType: "ProjectDeliverable",
      entityId: item.id,
      summary: `Attached "${fileName}" to "${item.title}"`,
      projectId: grant.projectId,
      changes: {
        fileSize: file.size,
        storage: video ? "drive" : "b2",
        public: stored.isPublicLink,
      },
    })

    return ok(
      serialize({
        data: {
          id: item.id,
          isVideo: video,
          shareUrl: stored.shareToken ? shareUrlFor(stored.shareToken) : null,
        },
      }),
    )
  })
}

/** Move an item to another state, by allowedTransition(..., "client") - same as the buttons. */
export async function setClientPlanStatus(
  projectRef: string,
  deliverableId: string,
  body: ClientPlanStatusInput,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "plan")
    const input = clientPlanStatusSchema.parse(body)
    const to = input.status

    const item = await findItem(grant.projectId, deliverableId)
    if (!item) return fail("Item not found", undefined, 404)

    const check = allowedTransition(item.status, to, "client")
    if (!check.ok) {
      // 403 = wrong person, 422 = not an allowed move.
      return fail(check.why, undefined, check.reason === "actor" ? 403 : 422)
    }
    const reason = input.reason?.trim() || null
    if (check.needs.includes("reason") && !reason) {
      return fail(
        to === "STUCK" ? "Say what it is waiting on" : "Say why it was dropped",
        undefined,
        422,
      )
    }

    const madeNow = to === "DELIVERED"
    const claimed = await db.projectDeliverable.updateMany({
      // Conditional on the status just read, so two concurrent moves can't both win.
      where: { id: item.id, status: item.status },
      data: {
        status: to,
        // Cleared on moves that don't need it, so a stale reason can't outlive its block.
        statusReason: check.needs.includes("reason") ? reason : null,
        // Marking it made fills the count; the portal never asks for a date, so use today.
        ...(madeNow
          ? { deliveredQuantity: item.quantity, completedOn: todayUtc() }
          : // Not made any more, so clear the date (the CHECK constraint allows null only here).
            { completedOn: null }),
      },
    })
    if (claimed.count === 0) {
      return fail("Somebody else just moved this item - reload to see it", undefined, 409)
    }

    await db.projectDeliverableEvent.create({
      data: {
        deliverableId: item.id,
        type: "STATUS_CHANGED",
        fromStatus: item.status,
        toStatus: to,
        reason,
        actorClientId: session.user.id,
      },
    })

    // Only states someone must act on; to-do -> in progress isn't news.
    const NOTIFY: Partial<Record<typeof to, { title: string; type: "success" | "warning" }>> = {
      DELIVERED: { title: "Client marked an item made", type: "success" },
      STUCK: { title: "Client flagged an item as stuck", type: "warning" },
      DISCARDED: { title: "Client discarded an item", type: "warning" },
    }
    const notice = NOTIFY[to]
    if (notice) {
      const watchers = await projectWatchers(grant.projectId)
      if (watchers.length > 0) {
        const slug = await projectSlug(grant.projectId)
        await createNotifications(
          watchers.map((employeeId) => ({
            employeeId,
            title: notice.title,
            message:
              `${session.user.name ?? "The client"} moved "${item.title}" to ` +
              `${DELIVERABLE_STATUS_LABELS[to].toLowerCase()} on ${grant.projectName}.` +
              (reason ? ` Reason: ${reason}` : ""),
            type: notice.type,
            link: `/projects/${slug}`,
          })),
        )
      }
    }

    await recordActivity(session, {
      action: "content_plan:set_status",
      module: "project",
      entityType: "ProjectDeliverable",
      entityId: item.id,
      summary: `Moved "${item.title}" to ${DELIVERABLE_STATUS_LABELS[to].toLowerCase()}`,
      projectId: grant.projectId,
      changes: { from: item.status, to, reason },
    })

    return ok(serialize({ data: { id: item.id, status: to } }))
  })
}

/**
 * Withdraw a request the client made that nobody has started. Attached files stay (FK is SET NULL).
 */
export async function deleteClientPlanItem(
  projectRef: string,
  deliverableId: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "plan")

    const item = await findItem(grant.projectId, deliverableId)
    if (!item) return fail("Item not found", undefined, 404)

    if (!mayWithdraw(item, session.user.id)) {
      if (item.loggedById || item.loggedByClientId !== session.user.id) {
        return fail("Only the person who asked for an item can withdraw it", undefined, 403)
      }
      return fail(
        "The team has already started this - ask them to drop it instead.",
        undefined,
        409,
      )
    }

    // Conditional on PLANNED, in case the team started work since the check above.
    const removed = await db.projectDeliverable.deleteMany({
      where: { id: item.id, projectId: grant.projectId, status: "PLANNED" },
    })
    if (removed.count === 0) {
      return fail("Somebody just started this - reload to see it", undefined, 409)
    }

    await recordActivity(session, {
      action: "content_plan:withdraw",
      module: "project",
      entityType: "ProjectDeliverable",
      entityId: item.id,
      summary: `Withdrew "${item.title}"`,
      projectId: grant.projectId,
    })

    return ok(serialize({ data: { id: item.id } }))
  })
}
