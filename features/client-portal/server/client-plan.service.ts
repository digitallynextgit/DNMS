import "server-only"

import { db } from "@/server/db"
import { requireClientModule } from "@/server/client-guard"
import { recordActivity } from "@/lib/activity"
import { createNotifications } from "@/lib/notifications"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { getObjectKey, uploadFile, getSignedUrl, deleteFile, isB2Configured } from "@/lib/storage"
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from "@/lib/constants"
import { allowedTransition } from "@/features/projects/lib/deliverable-lifecycle"
import { periodProblem } from "@/features/projects/lib/delivery-period"
import { cleanType, MAX_LINKS } from "@/features/projects/lib/deliverable-types"
import { isSafeHttpUrl } from "@/features/projects/lib/task-links"
import { mayWithdraw } from "../lib/plan-rules"
import {
  clientPlanCreateSchema,
  clientPlanDecisionSchema,
  clientPlanLinkSchema,
  type ClientPlanCreateInput,
  type ClientPlanDecisionInput,
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
    select: { id: true, fileName: true, fileSize: true, mimeType: true },
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
    ...new Set([...teams.map((t) => t.managerId), project?.ownerId].filter((v): v is string => !!v)),
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
      select: { id: true, objectKey: true, fileName: true },
    })
    // Indistinguishable from "does not exist": an id from another project, an
    // unshared file, or a document that is not a plan asset must all read the
    // same way.
    if (!file) return fail("File not found", undefined, 404)
    if (!isB2Configured()) return fail("File storage is not configured", undefined, 503)

    const url = await getSignedUrl(file.objectKey, 3600, {
      downloadFileName: opts.download ? file.fileName : undefined,
    })

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
      loggedById: true,
      loggedByClientId: true,
    },
  })
}

/**
 * Paste a link onto an item.
 *
 * "Upload or paste a link" is one feature with two doors; this is the cheap
 * one. The link JOINS whatever is already there rather than replacing it, so
 * two people attaching work at once cannot erase each other.
 */
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
    if (item.links.length >= MAX_LINKS) {
      return fail(`An item holds at most ${MAX_LINKS} links.`, undefined, 422)
    }

    const links = [...item.links, input.link]
    await db.projectDeliverable.update({ where: { id: item.id }, data: { links } })
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
    if (!isB2Configured()) return fail("File storage is not configured", undefined, 503)

    const item = await findItem(grant.projectId, deliverableId)
    if (!item) return fail("Item not found", undefined, 404)
    if (item.status === "ACCEPTED") {
      return fail("That item is finalised - ask the team to re-open it first.", undefined, 409)
    }

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

    const id = crypto.randomUUID()
    const fileName = file.name.slice(0, 200)
    const objectKey = getObjectKey(`project-resources/${grant.projectId}`, file.name, id)
    await uploadFile(objectKey, Buffer.from(await file.arrayBuffer()), file.type)

    try {
      await db.projectResource.create({
        data: {
          id,
          projectId: grant.projectId,
          deliverableId: item.id,
          category: "ASSETS",
          fileName,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          objectKey,
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
      // orphan nobody can reach and nobody will ever come back to clean up.
      await deleteFile(objectKey).catch(() => {})
      throw e
    }

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
      changes: { fileSize: file.size },
    })

    return ok(serialize({ data: { id: item.id } }))
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
export async function decideClientPlanItem(
  projectRef: string,
  deliverableId: string,
  body: ClientPlanDecisionInput,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "plan")
    const input = clientPlanDecisionSchema.parse(body)

    const item = await findItem(grant.projectId, deliverableId)
    if (!item) return fail("Item not found", undefined, 404)

    const to = input.decision === "FINALISE" ? "ACCEPTED" : "REJECTED"
    const check = allowedTransition(item.status, to, "client")
    if (!check.ok) {
      // A 403 and a 422 are different answers: wrong person, versus not a move.
      return fail(check.why, undefined, check.reason === "actor" ? 403 : 422)
    }
    const reason = input.reason?.trim() || null
    if (check.needs.includes("reason") && !reason) {
      return fail("Say what needs changing", undefined, 422)
    }

    // Conditional on the status just read, so two people deciding at once
    // cannot both win - the same guard the document review uses.
    const claimed = await db.projectDeliverable.updateMany({
      where: { id: item.id, status: item.status },
      data:
        to === "ACCEPTED"
          ? {
              status: "ACCEPTED",
              acceptedAt: new Date(),
              acceptedByClientId: session.user.id,
              acceptanceNote: reason,
            }
          : { status: "REJECTED" },
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

    const watchers = await projectWatchers(grant.projectId)
    if (watchers.length > 0) {
      const slug = await projectSlug(grant.projectId)
      await createNotifications(
        watchers.map((employeeId) => ({
          employeeId,
          title: to === "ACCEPTED" ? "Client finalised an item" : "Client requested changes",
          message: `${session.user.name ?? "The client"} ${
            to === "ACCEPTED" ? "finalised" : "sent back"
          } "${item.title}" on ${grant.projectName}.`,
          type: to === "ACCEPTED" ? ("success" as const) : ("warning" as const),
          link: `/projects/${slug}`,
        })),
      )
    }

    await recordActivity(session, {
      action: to === "ACCEPTED" ? "content_plan:finalise" : "content_plan:request_changes",
      module: "project",
      entityType: "ProjectDeliverable",
      entityId: item.id,
      summary: `${to === "ACCEPTED" ? "Finalised" : "Requested changes on"} "${item.title}"`,
      projectId: grant.projectId,
      changes: { reason },
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
