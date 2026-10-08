// Escalation ladder: unacknowledged alerts climb every ESCALATE_AFTER_MINUTES - level 0 the
// project's developers, 1 + the account manager, 2 + admins (each rung keeps the ones below).
// Every alert goes in-app (with push) and by email. Acknowledging freezes the ladder; only the
// site recovering or the renewal date moving closes an alert.

import "server-only"

import { db } from "@/server/db"
import { createNotification } from "@/lib/notifications"
import { addEmailJob } from "@/lib/queue"
import { getConfig } from "@/server/app-config"
import { SYSTEM_ROLES } from "@/lib/constants"
import { renderAlertEmail } from "../emails/alert"

/** Minutes at each rung before climbing to the next. */
export const ESCALATE_AFTER_MINUTES = 30

/** Deep link to the project's Monitoring tab (slug preferred; both forms resolve). */
export function projectMonitoringLink(slug: string | null, projectId: string): string {
  return `/projects/${slug ?? projectId}?tab=monitoring`
}

export type EscalationLevel = 0 | 1 | 2

export const LEVEL_LABELS: Record<EscalationLevel, string> = {
  0: "the project team",
  1: "the Account Manager",
  2: "Admin",
}

/** Employee ids to notify at `level` - deduped and cumulative. */
export async function audienceFor(input: {
  level: EscalationLevel
  ownerId?: string | null
  projectId?: string | null
}): Promise<string[]> {
  const ids = new Set<string>()

  // An explicitly-set owner on the monitor/asset is always included.
  if (input.ownerId) ids.add(input.ownerId)

  if (input.projectId) {
    // Level 0: the project's developers.
    const members = await db.projectTeamMember.findMany({
      where: { projectId: input.projectId, employee: { isActive: true } },
      select: { employeeId: true },
    })
    for (const m of members) ids.add(m.employeeId)

    // Level 1: the account manager (project owner).
    if (input.level >= 1) {
      const project = await db.project.findUnique({
        where: { id: input.projectId },
        select: { ownerId: true },
      })
      if (project?.ownerId) ids.add(project.ownerId)
    }
  }

  // Level 2: admins.
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

/** Notify everyone on the rung in-app and by email; neither channel can break the other. */
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
  const link = input.link ?? "/projects"

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
        // One message to the whole rung, so everyone sees who else knows.
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        profile: "notifications",
      })
    }
  } catch (err) {
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
