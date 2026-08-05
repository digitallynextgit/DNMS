import "server-only"

import { db } from "@/server/db"
import { createNotification } from "@/lib/notifications"
import { addEmailJob } from "@/lib/queue"
import { logActivity } from "@/features/projects/server/activity"
import type { RequirementStatus } from "@prisma/client"

/** A requirement stops being "live" once it reaches one of these. */
export const CLOSED_STATUSES: RequirementStatus[] = ["PROVIDED", "REJECTED", "CLOSED"]

export const REQUIREMENT_SELECT = {
  id: true,
  projectId: true,
  teamId: true,
  type: true,
  status: true,
  title: true,
  details: true,
  neededBy: true,
  resolvedAt: true,
  resolutionNote: true,
  createdAt: true,
  team: { select: { id: true, name: true } },
  raisedBy: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
  requestedFrom: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
  blockedTasks: { select: { id: true, title: true, status: true } },
} as const

/**
 * Who to tell when a requirement is raised: the person it is requested from,
 * plus the blocked team's manager so the lead knows their team is stuck. The
 * raiser is never notified about their own action.
 */
async function audienceForNew(args: {
  requestedFromId: string
  teamId: string | null
  raisedById: string
}): Promise<string[]> {
  const ids = new Set<string>([args.requestedFromId])
  if (args.teamId) {
    const team = await db.projectTeam.findUnique({
      where: { id: args.teamId },
      select: { managerId: true },
    })
    if (team?.managerId) ids.add(team.managerId)
  }
  ids.delete(args.raisedById)
  return [...ids]
}

export async function createRequirement(args: {
  projectId: string
  teamId: string | null
  raisedById: string
  requestedFromId: string
  type: string
  title: string
  details: string | null
  neededBy: Date | null
  blockedTaskIds: string[]
}) {
  const requirement = await db.projectRequirement.create({
    data: {
      projectId: args.projectId,
      teamId: args.teamId,
      raisedById: args.raisedById,
      requestedFromId: args.requestedFromId,
      type: args.type as never,
      title: args.title,
      details: args.details,
      neededBy: args.neededBy,
      // Linking here rather than in a second write, so a task can never be left
      // pointing at a requirement that failed to create.
      ...(args.blockedTaskIds.length > 0
        ? { blockedTasks: { connect: args.blockedTaskIds.map((id) => ({ id })) } }
        : {}),
    },
    select: REQUIREMENT_SELECT,
  })

  const project = await db.project.findUnique({
    where: { id: args.projectId },
    select: { name: true, slug: true, id: true },
  })
  const link = `/projects/${project?.slug ?? args.projectId}?tab=requirements`
  const who = `${requirement.raisedBy.firstName} ${requirement.raisedBy.lastName}`.trim()
  const teamLabel = requirement.team ? `${requirement.team.name} team` : "A team"
  const by = requirement.neededBy
    ? ` Needed by ${requirement.neededBy.toISOString().slice(0, 10)}.`
    : ""

  const audience = await audienceForNew(args)
  for (const employeeId of audience) {
    await createNotification({
      employeeId,
      title: "New requirement raised",
      message: `${who} needs "${requirement.title}" for ${project?.name ?? "a project"} (${teamLabel}).${by}`,
      type: "warning",
      link,
    })
  }

  // Email only the person who has to act; the manager copy stays in-app so the
  // inbox does not fill with things they cannot resolve.
  const owner = await db.employee.findUnique({
    where: { id: args.requestedFromId },
    select: { email: true, firstName: true },
  })
  if (owner && args.requestedFromId !== args.raisedById) {
    addEmailJob({
      to: owner.email,
      subject: `Requirement: ${requirement.title} - ${project?.name ?? "project"}`,
      html: `<p>Hi ${owner.firstName},</p>
             <p><strong>${who}</strong> has raised a requirement on <strong>${project?.name ?? "a project"}</strong>:</p>
             <p><strong>${requirement.title}</strong></p>
             ${requirement.details ? `<p>${requirement.details}</p>` : ""}
             ${requirement.neededBy ? `<p>Needed by: ${requirement.neededBy.toISOString().slice(0, 10)}</p>` : ""}
             <p>${requirement.blockedTasks.length} task(s) are waiting on this.</p>`,
      text: `${who} raised a requirement: ${requirement.title}`,
    })
  }

  await logActivity({
    projectId: args.projectId,
    actorId: args.raisedById,
    type: "REQUIREMENT_RAISED",
    entityType: "REQUIREMENT",
    entityId: requirement.id,
    meta: { title: requirement.title, type: requirement.type, requestedFrom: args.requestedFromId },
  })

  return requirement
}

export async function updateRequirementStatus(args: {
  requirementId: string
  actorId: string
  status: RequirementStatus
  resolutionNote: string | null
}) {
  const before = await db.projectRequirement.findUnique({
    where: { id: args.requirementId },
    select: { id: true, projectId: true, title: true, raisedById: true, status: true },
  })
  if (!before) return null

  const resolving = CLOSED_STATUSES.includes(args.status)

  const requirement = await db.$transaction(async (tx) => {
    const updated = await tx.projectRequirement.update({
      where: { id: args.requirementId },
      data: {
        status: args.status,
        resolutionNote: args.resolutionNote,
        resolvedAt: resolving ? new Date() : null,
        // Re-opening clears the reminder stamp so the nudge starts again.
        remindedAt: resolving ? undefined : null,
      },
      select: REQUIREMENT_SELECT,
    })
    // Resolved means the work is no longer blocked. Unlinking here is what keeps
    // "blocked" honest instead of a flag someone has to remember to clear.
    if (resolving) {
      await tx.projectTask.updateMany({
        where: { requirementId: args.requirementId },
        data: { requirementId: null },
      })
    }
    return updated
  })

  const project = await db.project.findUnique({
    where: { id: before.projectId },
    select: { name: true, slug: true },
  })

  if (args.actorId !== before.raisedById) {
    const LABEL: Record<string, string> = {
      OPEN: "reopened",
      IN_PROGRESS: "being worked on",
      PROVIDED: "provided",
      REJECTED: "rejected",
      CLOSED: "closed",
    }
    await createNotification({
      employeeId: before.raisedById,
      title: `Requirement ${LABEL[args.status] ?? "updated"}`,
      message: `"${before.title}" on ${project?.name ?? "your project"} is now ${LABEL[args.status] ?? args.status}.${
        args.resolutionNote ? ` Note: ${args.resolutionNote}` : ""
      }`,
      type: args.status === "REJECTED" ? "error" : "success",
      link: `/projects/${project?.slug ?? before.projectId}?tab=requirements`,
    })
  }

  await logActivity({
    projectId: before.projectId,
    actorId: args.actorId,
    type: "REQUIREMENT_STATUS_CHANGED",
    entityType: "REQUIREMENT",
    entityId: args.requirementId,
    meta: { title: before.title, from: before.status, to: args.status },
  })

  return requirement
}
