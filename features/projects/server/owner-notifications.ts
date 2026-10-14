import "server-only"

import { db } from "@/server/db"
import { tenantPath } from "@/server/tenant-request"
import { createNotification, createNotifications } from "@/lib/notifications"
import { LEAD_LABEL, type ProjectLeadRole } from "../lib/project-leads"
import { renderOwnerAssignedEmail } from "@/lib/email-layout"
import { addEmailJob } from "@/lib/queue"
import { currentPlanMonth } from "../lib/calendar-months"
import { serviceInfo } from "../lib/project-services"

/**
 * Tell someone they now own a service (and its calendar) or a calendar: in-app and by email. Not
 * when they picked themselves, and never for the silent admin_ account. Call from a request (the
 * email link needs the company's URL).
 */
export async function notifyOwnerAssigned(args: {
  projectId: string
  employeeId: string
  actorId: string
  /** The silent admin_ account assigned it: nobody is told. */
  silentActor?: boolean
  service?: string | null
  /** The calendar edition to open; for a service, its current month is found when omitted. */
  calendar?: { id: string; name: string } | null
  /** They are the service's secondary owner. */
  secondary?: boolean
}): Promise<void> {
  if (args.silentActor || args.employeeId === args.actorId) return
  const [project, owner, actor] = await Promise.all([
    db.project.findUnique({ where: { id: args.projectId }, select: { name: true, slug: true } }),
    db.employee.findUnique({
      where: { id: args.employeeId },
      select: { email: true, firstName: true },
    }),
    db.employee.findUnique({
      where: { id: args.actorId },
      select: { firstName: true, lastName: true },
    }),
  ])
  if (!project || !owner) return

  const serviceName = args.service ? (serviceInfo(args.service)?.name ?? args.service) : null
  let calendar = args.calendar ?? null
  if (!calendar && args.service) {
    const month = currentPlanMonth()
    const editions = await db.projectWorkbook.findMany({
      where: { projectId: args.projectId, service: args.service },
      orderBy: { periodMonth: "desc" },
      select: { id: true, name: true, periodMonth: true },
    })
    calendar =
      editions.find((w) => w.periodMonth?.toISOString().startsWith(month)) ?? editions[0] ?? null
  }

  const base = `/projects/${project.slug ?? args.projectId}`
  const link = calendar ? `${base}?tab=calendar&calendar=${calendar.id}` : base
  await createNotification({
    employeeId: args.employeeId,
    title: args.secondary
      ? "You're a secondary owner"
      : serviceName
        ? "You own a service"
        : "You own a calendar",
    message: args.secondary
      ? serviceName
        ? `You're now the secondary owner of ${serviceName} on ${project.name}: you cover its calendar whenever its owner is away.`
        : `You're now the secondary owner of the calendar "${calendar?.name}" on ${project.name}: you cover it whenever its owner is away.`
      : serviceName
        ? `You're now the owner of ${serviceName} on ${project.name}, and of its calendar.`
        : `You're now the owner of the calendar "${calendar?.name}" on ${project.name}.`,
    type: "info",
    link,
  })

  const mail = renderOwnerAssignedEmail({
    recipientFirstName: owner.firstName,
    assignedByName: actor ? `${actor.firstName} ${actor.lastName}`.trim() : "Your manager",
    projectName: project.name,
    serviceName,
    calendarName: calendar?.name ?? null,
    secondary: args.secondary,
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${await tenantPath(link)}`,
  })
  addEmailJob({ to: owner.email, subject: mail.subject, html: mail.html, text: mail.text })
}

/**
 * Tell people they are now a project's Account Manager (primary or secondary), in-app.
 * Not when they picked themselves; createNotifications already stays silent for admin_.
 */
export async function notifyLeadAssigned(args: {
  projectId: string
  assigned: { role: ProjectLeadRole; employeeId: string }[]
  actorId: string
}): Promise<void> {
  const told = args.assigned.filter((a) => a.employeeId !== args.actorId)
  if (told.length === 0) return
  const project = await db.project.findUnique({
    where: { id: args.projectId },
    select: { name: true, slug: true },
  })
  if (!project) return
  await createNotifications(
    told.map((a) => ({
      employeeId: a.employeeId,
      title: `New role: ${LEAD_LABEL[a.role]}`,
      message: `You're now the ${LEAD_LABEL[a.role]} of ${project.name}. You can manage the whole project.`,
      type: "info",
      link: `/projects/${project.slug ?? args.projectId}`,
    })),
  )
}
