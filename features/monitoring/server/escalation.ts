// =============================================================================
// Escalation ladder
// =============================================================================
// The registrar sent failure emails for six days and nothing happened, because
// an alert nobody is OBLIGED to acknowledge is indistinguishable from noise. So
// alerts climb until somebody acknowledges them:
//
//   level 0  the DEVELOPERS on the project (everyone in its teams)
//   level 1  + the ACCOUNT MANAGER
//   level 2  + ADMIN
//
// Each rung INCLUDES the ones below it - escalating must not quietly stop
// telling the people who can actually fix it.
//
// Every alert goes out on BOTH channels: in-app (with web push) and email. The
// outage began at midnight; an in-app notification only lands if someone has
// DNMS open, which at 00:05 nobody does.
//
// Acknowledging freezes the ladder. Nothing here auto-resolves - only the site
// coming back up, or the renewal date moving, closes an alert. Acknowledging
// means "I am on it", not "I made the alert go away".
// =============================================================================

import "server-only"

import { db } from "@/server/db"
import { createNotification } from "@/lib/notifications"
import { addEmailJob } from "@/lib/queue"
import { getConfig } from "@/server/app-config"
import { SYSTEM_ROLES } from "@/lib/constants"
import { renderAlertEmail } from "../emails/alert"

/** Minutes at each rung before climbing to the next. */
export const ESCALATE_AFTER_MINUTES = 30

/**
 * Deep link to the project's Monitoring tab, so an alert lands on the screen
 * that can act on it. Prefers the slug for a readable URL; both forms resolve.
 */
export function projectMonitoringLink(slug: string | null, projectId: string): string {
  return `/projects/${slug ?? projectId}?tab=monitoring`
}

export type EscalationLevel = 0 | 1 | 2

export const LEVEL_LABELS: Record<EscalationLevel, string> = {
  0: "the project team",
  1: "the Account Manager",
  2: "Admin",
}

/**
 * Who hears about this at `level`, as employee ids - deduped, cumulative.
 *
 * Level 0 is the project's TEAM MEMBERS, not a single named owner: the people
 * who can actually look at the site are the ones who should hear first, and a
 * single owner is a single point of failure (on leave, asleep, left).
 */
export async function audienceFor(input: {
  level: EscalationLevel
  ownerId?: string | null
  projectId?: string | null
}): Promise<string[]> {
  const ids = new Set<string>()

  // An explicitly-set owner on the monitor/asset is always included.
  if (input.ownerId) ids.add(input.ownerId)

  if (input.projectId) {
    // ── Level 0: developers on the project ──────────────────────────────────
    const members = await db.projectTeamMember.findMany({
      where: { projectId: input.projectId, employee: { isActive: true } },
      select: { employeeId: true },
    })
    for (const m of members) ids.add(m.employeeId)

    // ── Level 1: the Account Manager (the project's owner) ──────────────────
    if (input.level >= 1) {
      const project = await db.project.findUnique({
        where: { id: input.projectId },
        select: { ownerId: true },
      })
      if (project?.ownerId) ids.add(project.ownerId)
    }
  }

  // ── Level 2: admins ───────────────────────────────────────────────────────
  if (input.level >= 2) {
    const admins = await db.employee.findMany({
      where: {
        isActive: true,
        employeeRoles: { some: { role: { name: SYSTEM_ROLES.ADMIN } } },
      },
      select: { id: true },
    })
    for (const a of admins) ids.add(a.id)
  }

  return [...ids]
}

/**
 * Fan an alert out to everyone on the given rung, in-app AND by email.
 *
 * Neither channel is allowed to break the other: a bad address or a failed push
 * for one recipient must not stop the rest of the ladder being told.
 */
export async function notifyAudience(input: {
  level: EscalationLevel
  ownerId?: string | null
  projectId?: string | null
  title: string
  message: string
  link?: string
  type?: "info" | "warning" | "error" | "success"
  /** Drives the email's colour and subject prefix. */
  severity?: "critical" | "warning" | "info"
}): Promise<number> {
  const audienceIds = await audienceFor(input)
  if (audienceIds.length === 0) return 0

  const prefix = input.level === 0 ? "" : input.level === 1 ? "[Escalated] " : "[Unacknowledged] "
  const title = `${prefix}${input.title}`
  // Monitoring lives on the project, so every alert deep-links to the tab that
  // can actually act on it rather than a generic list.
  const link = input.link ?? "/projects"

  // ── In-app + web push ─────────────────────────────────────────────────────
  for (const employeeId of audienceIds) {
    try {
      await createNotification({
        employeeId,
        title,
        message: input.message,
        type: input.type ?? "error",
        link,
      })
    } catch {
      // One bad recipient must never stop the rest of the ladder.
    }
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  try {
    const people = await db.employee.findMany({
      where: { id: { in: audienceIds }, isActive: true, email: { not: "" } },
      select: { email: true },
    })
    const to = [...new Set(people.map((p) => p.email).filter(Boolean))]
    if (to.length > 0) {
      const appUrl = (await getConfig("APP_URL")) ?? process.env.NEXTAUTH_URL ?? ""
      const email = renderAlertEmail({
        title,
        message: input.message,
        severity: input.severity ?? (input.type === "warning" ? "warning" : "critical"),
        escalationNote:
          input.level > 0
            ? `This has been escalated to ${LEVEL_LABELS[input.level]} because nobody acknowledged it within ${ESCALATE_AFTER_MINUTES} minutes.`
            : undefined,
        actionUrl: appUrl ? `${appUrl.replace(/\/$/, "")}${link}` : undefined,
        actionLabel: "Open Monitoring",
      })
      addEmailJob({
        // One message to the whole rung rather than N separate sends: it is the
        // same alert, and a visible recipient list tells everyone who else knows.
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        profile: "notifications",
      })
    }
  } catch (err) {
    // Email failing must not take the in-app notifications down with it - they
    // have already been delivered by this point.
    console.error("[monitoring] alert email failed:", err)
  }

  return audienceIds.length
}

/** Whether an unacknowledged alert has sat at its current rung long enough. */
export function shouldEscalate(lastEscalatedAt: Date | null, level: number): boolean {
  if (level >= 2) return false // top of the ladder
  if (!lastEscalatedAt) return true
  const minutes = (Date.now() - lastEscalatedAt.getTime()) / 60_000
  return minutes >= ESCALATE_AFTER_MINUTES
}
