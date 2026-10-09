import "server-only"

import { db } from "@/server/db"
import { currentPlanMonth } from "../lib/calendar-months"
import { serviceInfo } from "../lib/project-services"
import { createSheet, createWorkbook, parsePeriodMonth } from "./sheets.service"

/**
 * Give each ticked service (or just `only`) its calendar: adopt a same-named series someone already
 * made, else start this month's edition with the service's tabs, managed by the service's owner.
 * Returns how many calendars it created.
 */
export async function ensureServiceCalendars(
  projectId: string,
  actorId: string | null,
  only?: string,
): Promise<number> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      services: true,
      serviceOwners: { select: { service: true, employeeId: true } },
    },
  })
  if (!project) return 0
  const linked = await db.projectWorkbook.findMany({
    where: { projectId, service: { not: null } },
    select: { service: true },
  })
  const have = new Set(linked.map((w) => w.service))

  let created = 0
  for (const code of project.services) {
    const info = serviceInfo(code)
    if (!info || have.has(code) || (only && code !== only)) continue

    const adopted = await db.projectWorkbook.updateMany({
      where: { projectId, name: info.calendar.name, service: null },
      data: { service: code },
    })
    if (adopted.count > 0) continue

    const [firstTab, ...moreTabs] = info.calendar.tabs
    const book = await createWorkbook(projectId, actorId, {
      name: info.calendar.name,
      firstTab,
      periodMonth: currentPlanMonth(),
      service: code,
    })
    for (const tab of moreTabs) {
      await createSheet(projectId, actorId, { workbookId: book.id, name: tab })
    }
    const ownerId = project.serviceOwners.find((o) => o.service === code)?.employeeId
    if (ownerId) {
      await db.projectWorkbook.update({ where: { id: book.id }, data: { assignedToId: ownerId } })
    }
    created++
  }
  return created
}

/** The service's owner manages its calendar from this month on; past months keep their manager. */
export async function syncServiceCalendarManager(
  projectId: string,
  service: string,
  employeeId: string | null,
): Promise<void> {
  const from = parsePeriodMonth(currentPlanMonth())!
  await db.projectWorkbook.updateMany({
    where: { projectId, service, OR: [{ periodMonth: null }, { periodMonth: { gte: from } }] },
    data: { assignedToId: employeeId },
  })
}
