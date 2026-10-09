import "server-only"

import { db } from "@/server/db"
import { tenantPath } from "@/server/tenant-request"
import { createNotification } from "@/lib/notifications"
import { renderOwnerAssignedEmail } from "@/lib/email-layout"
import { addEmailJob } from "@/lib/queue"
import { currentPlanMonth } from "../lib/calendar-months"
import { serviceInfo } from "../lib/project-services"

/**
 * Tell someone they now own a service (and its calendar) or a calendar: in-app and by email. Not
 * when they picked themselves. Call from a request (the email link needs the company's URL).
 */
export async function notifyOwnerAssigned(args: {
  projectId: string
  employeeId: string
  actorId: string
  service?: string | null
  /** The calendar edition to open; for a service, its current month is found when omitted. */
  calendar?: { id: string; name: string } | null
}): Promise<void> {
  if (args.employeeId === args.actorId) return
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
    title: serviceName ? "You own a service" : "You own a calendar",
    message: serviceName
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
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${await tenantPath(link)}`,
  })
  addEmailJob({ to: owner.email, subject: mail.subject, html: mail.html, text: mail.text })
}
