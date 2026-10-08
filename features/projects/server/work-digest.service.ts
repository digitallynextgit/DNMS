import "server-only"

import { db } from "@/server/db"
import { createNotifications } from "@/lib/notifications"
import { addEmailJob } from "@/lib/queue"
import { detailRow, wrapEmail, BRAND_NAME } from "@/lib/email-layout"
import { addDays, startOfDayUTC } from "@/lib/dates"
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/constants"

// Monday digest of work last week left behind, for the LAST COMPLETE Mon-Sun week. Idempotent via
// a unique digest_runs row per (kind, period): a second run loses the insert and sends nothing.

const MANAGER_LINK = "/projects/progress"
const MEMBER_LINK = "/projects/my-tasks"

const DIGEST_KIND = "weekly-work"

// Made statuses (own copy of the lifecycle constant) - check here when adding a deliverable status.
const MADE_STATUSES = ["DELIVERED", "ACCEPTED", "REJECTED"] as const

const TASK_CLOSED = ["DONE", "CANCELLED", "DISCARDED"] as const

/** A week ahead, so nothing is reported twice. */
const DUE_SOON_DAYS = 7

/** Longest list printed per section before it becomes "and N more". */
const MAX_ITEMS = 10

export interface WorkDigestResult {
  /** Recipients who actually received a notification + email. */
  sent: number
  /** True when this period's digest had already been claimed by another run. */
  skipped: boolean
}

interface DigestLine {
  project: string
  label: string
}

/** Sections in mail order. `short` feeds the in-app summary; `urgent` makes it a warning. */
const SECTIONS = [
  {
    key: "doneWithoutOutput",
    title: "Done last week with nothing logged",
    short: "done without output",
    urgent: true,
  },
  {
    key: "unlinked",
    title: "Open tasks not linked to a goal",
    short: "not linked to a goal",
    urgent: false,
  },
  {
    key: "overdueGoals",
    title: "Goals past their target date",
    short: "goals past target",
    urgent: true,
  },
  {
    key: "deliverablesOverdue",
    title: "Deliverables overdue",
    short: "deliverables overdue",
    urgent: true,
  },
  {
    key: "deliverablesDueSoon",
    title: "Deliverables due this week",
    short: "due this week",
    urgent: false,
  },
  {
    key: "awaitingRevision",
    title: "Sent back for revision",
    short: "awaiting revision",
    urgent: false,
  },
] as const

type SectionKey = (typeof SECTIONS)[number]["key"]

/** What one person is told, keyed by section. Empty sections are dropped. */
type Payload = Map<SectionKey, DigestLine[]>

/** Send the weekly digest for the current tenant - call inside withCron / forEachTenant. */
export async function runWeeklyWorkDigest(now: Date = new Date()): Promise<WorkDigestResult> {
  const today = startOfDayUTC(now)
  // getUTCDay() is 0 on Sunday, hence +6 %7. The period is last week's Mon-Sun.
  const thisMonday = addDays(today, -((today.getUTCDay() + 6) % 7))
  const periodStart = addDays(thisMonday, -7)
  const periodEnd = thisMonday

  // Claim the period BEFORE any work: a duplicate digest is worse than a late one.
  try {
    await db.digestRun.create({ data: { kind: DIGEST_KIND, periodStart } })
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { sent: 0, skipped: true }
    }
    throw err
  }

  const projects = await db.project.findMany({
    where: { isArchived: false, status: { in: ["PLANNING", "ACTIVE"] } },
    select: {
      id: true,
      name: true,
      ownerId: true,
      teams: { select: { id: true, managerId: true } },
    },
  })

  if (projects.length === 0) {
    console.info("[WORK_DIGEST] no active projects - nothing to report")
    return { sent: 0, skipped: false }
  }

  const projectIds = projects.map((p) => p.id)
  const projectName = new Map(projects.map((p) => [p.id, p.name] as const))

  // projectManagers see everything on a project; teamManagers only their team's tasks and
  // deliverables (goals are project-level).
  const projectManagers = new Map<string, Set<string>>()
  const teamManagers = new Map<string, Set<string>>()

  const addTo = (index: Map<string, Set<string>>, key: string, employeeId: string) => {
    const set = index.get(key)
    if (set) set.add(employeeId)
    else index.set(key, new Set([employeeId]))
  }

  for (const project of projects) {
    addTo(projectManagers, project.id, project.ownerId)
    for (const team of project.teams) {
      if (team.managerId) addTo(teamManagers, team.id, team.managerId)
    }
  }

  // No session in a cron: resolve project:write via roles. admin_ (silent watch account) is excluded.
  const globalManagers = await db.employee.findMany({
    where: {
      isActive: true,
      employeeRoles: {
        some: {
          role: {
            rolePermissions: { some: { permission: { scope: PERMISSIONS.PROJECT_WRITE } } },
          },
        },
      },
      NOT: { employeeRoles: { some: { role: { name: SYSTEM_ROLES.ADMIN_ } } } },
    },
    select: { id: true },
  })
  for (const manager of globalManagers) {
    for (const id of projectIds) addTo(projectManagers, id, manager.id)
  }

  const [doneWithoutOutput, unlinked, overdueGoals, dated, rejected] = await Promise.all([
    // Done, meant to produce output, not marked "nothing to log", and no deliverable against it.
    db.projectTask.findMany({
      where: {
        projectId: { in: projectIds },
        status: "DONE",
        producesOutput: true,
        outputSkippedAt: null,
        completedAt: { gte: periodStart, lt: periodEnd },
        deliverables: { none: { status: { in: [...MADE_STATUSES] } } },
      },
      select: { id: true, title: true, projectId: true, teamId: true, assigneeId: true },
    }),
    // Open work serving no goal.
    db.projectTask.findMany({
      where: {
        projectId: { in: projectIds },
        goalId: null,
        status: { notIn: [...TASK_CLOSED] },
      },
      select: { id: true, title: true, projectId: true, teamId: true },
    }),
    // Overdue only; "slipping" needs the goals module's maths.
    db.projectGoal.findMany({
      where: {
        projectId: { in: projectIds },
        isActive: true,
        status: { notIn: ["DONE", "DISCARDED"] },
        targetDate: { not: null, lt: today },
      },
      select: { id: true, title: true, projectId: true, targetDate: true },
    }),
    // Owed output, overdue or landing this week - one query, split below.
    db.projectDeliverable.findMany({
      where: {
        projectId: { in: projectIds },
        // STUCK included: blocked output is exactly what a chase list is for.
        status: { in: ["PLANNED", "IN_PROGRESS", "STUCK"] },
        dueOn: { not: null, lt: addDays(today, DUE_SOON_DAYS + 1) },
      },
      select: {
        id: true,
        title: true,
        type: true,
        quantity: true,
        dueOn: true,
        projectId: true,
        teamId: true,
        employeeId: true,
      },
    }),
    // The client asked for it again and it has not gone back out.
    db.projectDeliverable.findMany({
      where: { projectId: { in: projectIds }, status: "REJECTED" },
      select: { id: true, title: true, type: true, projectId: true, teamId: true },
    }),
  ])

  const payloads = new Map<string, Payload>()

  const push = (employeeIds: Iterable<string>, section: SectionKey, line: DigestLine) => {
    for (const employeeId of employeeIds) {
      let payload = payloads.get(employeeId)
      if (!payload) {
        payload = new Map()
        payloads.set(employeeId, payload)
      }
      const lines = payload.get(section)
      if (lines) lines.push(line)
      else payload.set(section, [line])
    }
  }

  /** Project managers + team manager + optional owner; a Set so nobody reads a line twice. */
  const audience = (
    projectId: string | null,
    teamId?: string | null,
    ownerId?: string | null,
  ): Set<string> => {
    const ids = new Set<string>()
    if (projectId) for (const id of projectManagers.get(projectId) ?? []) ids.add(id)
    if (teamId) for (const id of teamManagers.get(teamId) ?? []) ids.add(id)
    if (ownerId) ids.add(ownerId)
    return ids
  }

  for (const task of doneWithoutOutput) {
    // Only the assignee can say what came of it, so they hear too.
    const to = audience(task.projectId, task.teamId, task.assigneeId)
    push(to, "doneWithoutOutput", {
      project: projectLabel(projectName, task.projectId),
      label: task.title,
    })
  }

  for (const task of unlinked) {
    // Managers only: a planning gap, not the assignee's call.
    push(audience(task.projectId, task.teamId), "unlinked", {
      project: projectLabel(projectName, task.projectId),
      label: task.title,
    })
  }

  for (const goal of overdueGoals) {
    // No team scope on a goal - only whole-project managers are accountable.
    push(projectManagers.get(goal.projectId) ?? [], "overdueGoals", {
      project: projectLabel(projectName, goal.projectId),
      label: `${goal.title} · target ${formatDay(goal.targetDate)}`,
    })
  }

  for (const row of dated) {
    const overdue = !!row.dueOn && row.dueOn < today
    const section: SectionKey = overdue ? "deliverablesOverdue" : "deliverablesDueSoon"
    push(audience(row.projectId, row.teamId, row.employeeId), section, {
      project: projectLabel(projectName, row.projectId),
      label: `${row.title} (${row.type} ×${row.quantity}) · due ${formatDay(row.dueOn)}`,
    })
  }

  for (const row of rejected) {
    push(audience(row.projectId, row.teamId), "awaitingRevision", {
      project: projectLabel(projectName, row.projectId),
      label: `${row.title} (${row.type})`,
    })
  }

  if (payloads.size === 0) {
    console.info("[WORK_DIGEST] nothing to report for the week of", iso(periodStart))
    return { sent: 0, skipped: false }
  }

  // A manager who also does the work gets ONE mail; only the link differs.
  const managerIds = new Set<string>()
  for (const index of [projectManagers, teamManagers]) {
    for (const set of index.values()) for (const id of set) managerIds.add(id)
  }

  const recipients = await db.employee.findMany({
    // Departed employees get nothing (filtered once here, not in all five queries).
    where: { id: { in: [...payloads.keys()] }, isActive: true },
    select: { id: true, firstName: true, email: true },
  })

  const periodLabel = `${formatDay(periodStart)} - ${formatDay(addDays(periodEnd, -1))}`
  const notifications: Array<{
    employeeId: string
    title: string
    message: string
    type: "info" | "warning"
    link: string
  }> = []
  let sent = 0

  for (const recipient of recipients) {
    const payload = payloads.get(recipient.id)
    if (!payload || payload.size === 0) continue

    const buckets: DigestBucket[] = SECTIONS.map((section) => ({
      title: section.title,
      short: section.short,
      urgent: section.urgent,
      lines: payload.get(section.key) ?? [],
    })).filter((b) => b.lines.length > 0)
    if (buckets.length === 0) continue

    const link = managerIds.has(recipient.id) ? MANAGER_LINK : MEMBER_LINK
    const total = buckets.reduce((sum, b) => sum + b.lines.length, 0)
    const summary = buckets.map((b) => `${b.lines.length} ${b.short}`).join(" · ")

    notifications.push({
      employeeId: recipient.id,
      title: "Weekly work digest",
      message: `${periodLabel}: ${summary}.`,
      // Something already late is a warning; a tidy-up list is not.
      type: buckets.some((b) => b.urgent) ? "warning" : "info",
      link,
    })

    const mail = renderDigestEmail({
      firstName: recipient.firstName,
      periodLabel,
      buckets,
      total,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${link}`,
    })
    addEmailJob({ to: recipient.email, subject: mail.subject, html: mail.html, text: mail.text })
    sent++
  }

  if (notifications.length > 0) await createNotifications(notifications)

  console.info(
    `[WORK_DIGEST] week of ${iso(periodStart)}: ${sent} recipient(s) notified ` +
      `(${doneWithoutOutput.length} done without output, ${unlinked.length} unlinked, ` +
      `${overdueGoals.length} overdue goal(s), ${dated.length} owed, ${rejected.length} awaiting revision)`,
  )

  return { sent, skipped: false }
}

interface DigestBucket {
  title: string
  /** Short form for the one-line in-app summary. */
  short: string
  /** True when the section is about something already late. */
  urgent: boolean
  lines: DigestLine[]
}

/** Count table first, then each section capped at MAX_ITEMS - inbox digests must stay short. */
function renderDigestEmail(input: {
  firstName: string
  periodLabel: string
  buckets: DigestBucket[]
  total: number
  url: string
}): { subject: string; html: string; text: string } {
  const { firstName, periodLabel, buckets, total, url } = input
  const subject = `Weekly work digest - ${periodLabel}`
  const para = "margin:0 0 16px; font-size:15px; line-height:1.7; color:#374151;"

  const lists = buckets
    .map((bucket) => {
      const shown = bucket.lines.slice(0, MAX_ITEMS)
      const rest = bucket.lines.length - shown.length
      const items = shown
        .map(
          (line) =>
            `<li style="margin:0 0 6px; font-size:14px; line-height:1.6; color:#374151;">
               <strong style="color:#111827;">${escapeHtml(line.project)}</strong> &middot; ${escapeHtml(line.label)}
             </li>`,
        )
        .join("")
      const more =
        rest > 0 ? `<li style="font-size:13px; color:#9ca3af;">and ${rest} more</li>` : ""
      return `
        <h2 style="margin:24px 0 8px; font-size:14px; font-weight:600; color:#111827;">
          ${escapeHtml(bucket.title)} (${bucket.lines.length})
        </h2>
        <ul style="margin:0; padding-left:18px;">${items}${more}</ul>`
    })
    .join("")

  const body = `
    <h1 style="margin:0 0 14px; font-size:20px; font-weight:600; color:#111827;">Last week's loose ends</h1>

    <p style="margin:0 0 18px; font-size:15px; color:#111827;">Hi ${escapeHtml(firstName)},</p>

    <p style="${para}">
      ${total} item${total === 1 ? "" : "s"} from <strong style="color:#111827;">${escapeHtml(periodLabel)}</strong>
      still need something from you.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      ${buckets.map((b) => detailRow(b.title, String(b.lines.length))).join("")}
    </table>

    ${lists}

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
      <tr><td style="border-radius:4px; background:#171717;">
        <a href="${url}" style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">
          Open in ${BRAND_NAME}
        </a>
      </td></tr>
    </table>`

  const text = [
    `Last week's loose ends - ${periodLabel}`,
    "",
    `Hi ${firstName}, ${total} item${total === 1 ? "" : "s"} still need something from you.`,
    ...buckets.flatMap((bucket) => {
      const shown = bucket.lines.slice(0, MAX_ITEMS)
      const rest = bucket.lines.length - shown.length
      return [
        "",
        `${bucket.title} (${bucket.lines.length})`,
        ...shown.map((line) => `- ${line.project} · ${line.label}`),
        ...(rest > 0 ? [`- and ${rest} more`] : []),
      ]
    }),
    "",
    url,
    "",
    `- ${BRAND_NAME}`,
  ].join("\n")

  return { subject, html: wrapEmail({ title: subject, bodyHtml: body }), text }
}

function projectLabel(names: Map<string, string>, projectId: string | null): string {
  return (projectId && names.get(projectId)) || "Project"
}

function formatDay(date: Date | null): string {
  if (!date) return "no date"
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ""}`.trim()
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Escape before inlining anything user-typed into email HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
