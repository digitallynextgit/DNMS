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

// =============================================================================
// The content plan, from the CLIENT side.
// =============================================================================
// Same rows as the team's deliverables board - not a parallel table. A plan the
// client cannot see the team working against is a spreadsheet, and two tables
// both holding "what we owe you" would disagree within a week.
//
// What differs is the VIEW and the VERBS:
//
//   sees     what was planned, what is made, what is waiting on them. Never
//            hours, never who made it, never the internal note.
//   plans    adds rows between two dates, with a brief. They land PLANNED and
//            unassigned - the account manager routes them and the team manager
//            puts names to them, exactly as when staff plan a period.
//   attaches a finished link or file to an item.
//   decides  finalises a delivered item, or sends it back with a reason.
//   withdraws a request they made that nobody has started yet.
//
// Everything else - starting work, marking it delivered, deleting a row,
// re-opening something already finalised - is refused, and refused by the same
// transition table the staff board obeys (allowedTransition as "client"), so a
// button the portal draws is never one the server then declines.
//
// Every entry point starts with requireClientModule(projectRef, "plan"), which
// re-proves the session, the grant and the module. The projectRef in the URL is
// a lookup key, never an authorisation: queries filter on grant.projectId.
// =============================================================================

/**
 * What the portal is allowed to know about one item.
 *
 * Hand-written and deliberately short. Absent entirely: hours, the maker, the
 * QC verifier, the task it came out of, and the team that owes it.
 *
 * `notes` and `loggedById` ARE read, but only so the list can work out whether
 * the note on a row is the client's own brief. Neither is returned - see the
 * mapping in listClientPlan.
 */
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
  // Which internal team owes it is not the client's business, and naming them
  // would expose the company's structure for no gain - the AM routes the work.
  loggedByClient: { select: { id: true, name: true } },
  // Read, but NEVER returned as-is: see the mapping below.
  notes: true,
  loggedById: true,
  loggedByClientId: true,
  acceptedByClient: { select: { id: true, name: true } },
  files: {
    // Only files shared with the client. A deliverable can carry internal
    // working files too, and the portal must not list them.
    where: { isClientVisible: true },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      // Read to BUILD the share url below, never returned under its own name -
      // see the mapping in listClientPlan, same treatment as `notes`.
      // driveWebViewLink is deliberately absent: it is the internal Drive link
      // and only asks an outsider to request access.
      shareToken: true,
      isPublicLink: true,
      // Turned into `isMine` below. The UI needs to know which assets carry a
      // delete button, and it must be the SAME question the server asks when the
      // delete arrives - a button that 404s is worse than no button.
      uploadedByClientId: true,
    },
  },
} as const

/**
 * A DATE column as the browser needs it: "2026-09-14", not a timestamp.
 *
 * serialize() turns a Date into a full ISO string, and every date helper on the
 * other side - the period grouping, the week headings - parses "yyyy-MM-dd" by
 * appending its own time part. Handed a full timestamp they build
 * "2026-09-14T00:00:00.000ZT00:00:00.000Z", which is an Invalid Date, and a
 * period reads "NaN undefined NaN". The staff row mapper has always trimmed
 * these; this one has to as well.
 */
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

    // ── `notes` NEVER leaves this function under its own name ─────────────────
    // That column is where the TEAM talks to itself about the work. On a row
    // the client wrote, it holds their own brief and is theirs to read back;
    // on any other row it is internal. Renaming it on the way out makes that
    // distinction structural: there is no `notes` field in the response for a
    // future change to accidentally start populating.
    const items = rows.map(({ notes, loggedById, loggedByClientId, ...row }) => ({
      ...row,
      // Same treatment as `notes` above: the raw token never leaves under its
      // own name. It is turned into the finished url here, so there is no
      // `shareToken` field in the response for a future change to start
      // populating somewhere it should not go.
      files: row.files.map(({ shareToken, uploadedByClientId, ...f }) => ({
        ...f,
        shareUrl: shareToken ? shareUrlFor(shareToken) : null,
        isMine: uploadedByClientId === session.user.id,
      })),
      // What the row has attached against what was planned, so the UI can label
      // the buttons and disable them at the ceiling instead of letting someone
      // sit through an upload that the server was always going to refuse.
      attached: row.files.length + row.links.length,
      // Dates as days, never timestamps - see asDay.
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

    // Grouping into periods happens in the browser, from the same pure helper
    // the staff board uses, so the two cannot drift apart.
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
 * The team a client-planned row is filed under until somebody routes it.
 *
 * The client is not asked which team should do the work - they should not have
 * to know the company's internal structure to ask for a video. But the row
 * cannot be team-less either: `project_deliverables_owner_check` permits a row
 * with no employee ONLY while it is PLANNED or IN_PROGRESS and names a team.
 *
 * So it lands with the account-management team, which is where an unrouted
 * client request belongs anyway, and the AM moves it. ADMIN by name where the
 * project has one; otherwise the first team, so the row still lands somewhere
 * real rather than failing in front of the client.
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

/**
 * The client plans a period: N of this, M of that, between two dates, each
 * with a brief.
 *
 * Rows land PLANNED and UNASSIGNED. That is the same two-step handoff staff
 * planning uses - somebody says what is wanted, a manager decides who makes
 * it - with one extra step in front: the account manager also decides WHICH
 * TEAM, because the client was not asked.
 */
export async function createClientPlanLines(
  projectRef: string,
  body: ClientPlanCreateInput,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "plan")
    const input = clientPlanCreateSchema.parse(body)

    const start = new Date(`${input.periodStart}T00:00:00.000Z`)
    const end = new Date(`${input.periodEnd}T00:00:00.000Z`)
    // The same validator the staff planner runs, so a range accepted on one
    // side is accepted on the other.
    const problem = periodProblem(start, end)
    if (problem) return fail(problem, undefined, 422)

    const teamId = await intakeTeamId(grant.projectId)
    if (!teamId) {
      // Nothing to hang the row on, and the CHECK constraint would refuse it.
      // Said without internal vocabulary: "team" is our word, not theirs.
      return fail(
        "This project is not set up for planning yet - your account manager can sort that out.",
        undefined,
        409,
      )
    }

    // Match the project's existing vocabulary case-insensitively, so a client
    // typing "reel" cannot split the count away from the team's "Reel".
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
      // Nobody is on it yet - that is the team manager's call.
      employeeId: null,
      // The client wrote this entry. loggedById stays null: it is a foreign key
      // to employees, and this was not an employee.
      loggedById: null,
      loggedByClientId: session.user.id,
      type: canonical(l.type),
      title: l.title,
      quantity: l.quantity,
      // The brief lands in `notes`, which the staff board already renders - so
      // the team reads what was asked for without any extra plumbing.
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
 * A short-lived signed URL for one asset hanging off a plan item.
 *
 * Three conditions, all of them load-bearing: the file is on THIS project, it
 * is shared with the client, and it belongs to a deliverable. That last one
 * keeps this endpoint to plan assets alone - a document shared through the
 * Documents module is not reachable here, so holding "plan" does not quietly
 * grant a second module's contents.
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
    // Indistinguishable from "does not exist": an id from another project, an
    // unshared file, or a document that is not a plan asset must all read the
    // same way.
    if (!file) return fail("File not found", undefined, 404)

    // Drive-hosted (video): point at OUR authenticated stream route, never at
    // Drive's own webViewLink. A portal client has no Google account in that
    // Workspace, so Drive would answer them with a request-access page rather
    // than the video - and the file is deliberately not public there.
    let url: string
    if (file.driveFileId) {
      url = `/api/portal/projects/${projectRef}/plan/assets/${file.id}/stream`
    } else {
      if (!isB2Configured()) return fail("File storage is not configured", undefined, 503)
      // Non-null by the table's CHECK constraint: a row has one store or the
      // other, so no objectKey here means it is Drive-hosted, handled above.
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
      // quantity + the attachment count are what the capacity rule below reads:
      // an item asking for 2 videos takes 2 attachments, not 2 files AND 2 links.
      quantity: true,
      loggedById: true,
      loggedByClientId: true,
      _count: { select: { files: { where: { isClientVisible: true } } } },
    },
  })
}

/**
 * How many attachments an item already holds, against how many were planned.
 *
 * Files and links are counted TOGETHER because they are two ways of delivering
 * the same thing - a reel handed over as an upload or as a YouTube link is one
 * reel either way. Counting them separately would let a "2 videos" item quietly
 * accumulate four.
 */
function capacity(item: { quantity: number; links: string[]; _count: { files: number } }) {
  const used = item._count.files + item.links.length
  return { used, limit: item.quantity, full: used >= item.quantity }
}

/**
 * Paste a link onto an item.
 *
 * "Upload or paste a link" is one feature with two doors; this is the cheap
 * one. The link JOINS whatever is already there rather than replacing it, so
 * two people attaching work at once cannot erase each other.
 */
/**
 * Remove an asset the client attached to a plan item.
 *
 * Scoped to THEIR OWN uploads (`uploadedByClientId`), which is the same rule the
 * documents module enforces: a file the team published to the client is not the
 * client's to delete.
 *
 * Deliberately NOT gated on review or acceptance state. The portal is used to
 * keep an event's files tidy rather than to run an approval loop, so refusing to
 * remove a wrong file because a status column says "approved" would block the
 * only thing the person is actually trying to do.
 *
 * Deletes the stored object as well as the row - and for a shared video that
 * means revoking the public link first, or the thing they just deleted keeps
 * playing for everyone holding the URL.
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

    // Row first: an orphaned object is a cleanup job, but a row pointing at
    // bytes that are already gone is a dead link in the UI.
    await db.projectResource.delete({ where: { id: file.id } })
    try {
      if (file.driveFileId) await deleteVideoAsset(file.driveFileId)
      else if (file.objectKey) await deleteFile(file.objectKey)
    } catch (e) {
      console.error("[portal] asset object delete failed", file.objectKey ?? file.driveFileId, e)
    }

    if (file.deliverable) {
      // One fewer thing exists. Read AFTER the delete above, so this is the new
      // total and `before` is one more. syncMadeCount leaves a count already
      // running ahead of the attachments alone, so removing a file cannot wipe
      // out work staff recorded but never uploaded.
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

/**
 * Withdraw a video's public share link.
 *
 * The whole argument for serving share links ourselves rather than publishing to
 * Drive is that they can be taken back, so this is not a nicety - it is the half
 * that makes the design defensible. Clearing the token kills the URL on the next
 * request; the video itself stays in Drive and in the portal, untouched.
 *
 * Idempotent: revoking an already-revoked file succeeds rather than 404ing, so a
 * double click cannot leave the person unsure whether the link is dead.
 */
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
    // Already there is not a failure; it is the same outcome the person wanted.
    if (item.links.includes(input.link)) {
      return ok(serialize({ data: { id: item.id, links: item.links } }))
    }
    // Same combined budget the upload path checks - see capacity().
    const cap = capacity(item)
    if (cap.full) {
      return fail(
        `"${item.title}" was planned for ${cap.limit}, and ${cap.used} ${cap.used === 1 ? "is" : "are"} already attached. Remove one first, or ask the team to raise the quantity.`,
        undefined,
        422,
      )
    }
    // Still a hard ceiling, for the case where someone plans a quantity of 500.
    if (item.links.length >= MAX_LINKS) {
      return fail(`An item holds at most ${MAX_LINKS} links.`, undefined, 422)
    }

    const links = [...item.links, input.link]
    await db.projectDeliverable.update({ where: { id: item.id }, data: { links } })
    // A pasted link is a delivery too - the cheap half of "upload or link" - so
    // it counts toward Made exactly as a file does.
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

/**
 * Upload a file against an item.
 *
 * The other door. The file is a ProjectResource like any other, shared and
 * IN_REVIEW: the client put it there for the team to look at, so hiding it
 * would be pointless and marking it approved would let one side approve its
 * own submission.
 */
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

    // Checked BEFORE the bytes move: refusing a 200 MB upload after it has
    // already been pushed to Drive wastes the wait and leaves a file to clean up.
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

    // Where the bytes go decides everything below, so resolve it first. Video is
    // the Drive case: too big for the cap below, and meant to be shareable.
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
        // Size / not-configured are the user's problem to act on, so they come
        // back as a message rather than a 500.
        if (e instanceof VideoUploadError) return fail(e.message, undefined, e.status)
        throw e
      }
      stored = {
        objectKey: null,
        driveFileId: uploaded.driveFileId,
        driveWebViewLink: uploaded.webViewLink,
        // Video is shareable the moment it lands - that is what the client
        // uploaded it for. The link is revocable per file from the row.
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
      // Checked on extension when the browser sent no MIME type. Testing
      // `file.type &&` alone waved through every type-less file, which is most of
      // what a determined uploader would send.
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
          // The client is the uploader - uploadedById stays null. The CHECK
          // constraint on the table enforces exactly one of the two.
          uploadedById: null,
          uploadedByClientId: session.user.id,
          isClientVisible: true,
          sharedAt: new Date(),
          reviewStatus: "IN_REVIEW",
        },
        select: { id: true },
      })
    } catch (e) {
      // The object is up but the row failed. Leaving it behind would be an
      // orphan nobody can reach and nobody will ever come back to clean up -
      // and for a published video, one nobody can un-publish either.
      await undoUpload().catch(() => {})
      throw e
    }

    // One more thing exists than a moment ago, so Made moves with it. Counted
    // from the table rather than from `cap.used` - that one deliberately sees
    // only client-visible files, and Made counts the team's internal ones too.
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
          // The finished link, handed back once so the UI can offer it straight
          // away rather than making them hunt for the row.
          shareUrl: stored.shareToken ? shareUrlFor(stored.shareToken) : null,
        },
      }),
    )
  })
}

/**
 * The verdict: finalise a delivered item, or send it back with a reason.
 *
 * Routed through the SAME transition table the staff board obeys, asked as the
 * "client" actor. That table is where the rules live, so this function never
 * restates them - including the one that matters most: a client cannot re-open
 * what they already finalised. Their word is meant to be the last one, and the
 * account manager's ability to re-open it is what makes giving them that word
 * safe in the first place.
 */
/**
 * Move one item to another state, from the portal.
 *
 * Replaces the old finalise / request-changes pair. The portal is used to track
 * an event's work rather than to run sign-off, so the client says where a thing
 * has got to - to do, underway, made, blocked, dropped - and the verdict states
 * (ACCEPTED / REJECTED) stay with the staff side where they started.
 *
 * Every rule still comes from `allowedTransition(..., "client")`, the same table
 * the buttons are drawn from, so the portal can never offer a move this then
 * refuses.
 */
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
      // A 403 and a 422 are different answers: wrong person, versus not a move.
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
      // Conditional on the status just read, so two people moving the same row
      // at once cannot both win - the same guard the document review uses.
      where: { id: item.id, status: item.status },
      data: {
        status: to,
        // Cleared on every move that does not need one, so a stale "waiting on
        // the venue" cannot outlive the block it described.
        statusReason: check.needs.includes("reason") ? reason : null,
        // Marking it made fills the count: a row reading "Made" beside "0 of 8"
        // is the mismatch this whole column was confusing people with. The
        // portal is never asked for a date, so the server supplies today.
        ...(madeNow
          ? { deliveredQuantity: item.quantity, completedOn: todayUtc() }
          : // Leaving it behind would date work that is no longer finished -
            // and the CHECK constraint only permits a null here off the made
            // states, which is exactly where these moves land.
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

    // Only the states somebody needs to act on. A row ticking from to-do to in
    // progress is not news, and a digest nobody trusts is one that pinged them
    // for every keystroke.
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
 * Withdraw a request the client made and nobody has picked up.
 *
 * Deliberately narrow - see mayWithdraw for why each condition is there. The
 * refusal says WHICH condition failed, because "you cannot delete this" with no
 * reason is the kind of message people raise a ticket about.
 *
 * Files attached to the item are NOT deleted. The foreign key is SET NULL, so
 * they stay on the project and remain in Documents & assets: a withdrawn plan
 * line must not take real work product with it.
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
      // Not theirs at all reads as missing, the way it does everywhere else -
      // an id from elsewhere must not be confirmed as real by a 403.
      if (item.loggedById || item.loggedByClientId !== session.user.id) {
        return fail("Only the person who asked for an item can withdraw it", undefined, 403)
      }
      return fail(
        "The team has already started this - ask them to drop it instead.",
        undefined,
        409,
      )
    }

    // Conditional on the status just read: if the team starts work between the
    // check above and this line, the delete must not go through.
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
