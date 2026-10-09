import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withTeamStaffing } from "@/features/projects/server/project-access"
import {
  assignWorkbook,
  parsePeriodMonth,
  workbookBelongsToProject,
} from "@/features/projects/server/sheets.service"
import {
  ServiceOwnerError,
  setServiceOwner,
} from "@/features/projects/server/project-service-owners"
import { notifyOwnerAssigned } from "@/features/projects/server/owner-notifications"
import { currentPlanMonth } from "@/features/projects/lib/calendar-months"
import { logActivity } from "@/features/projects/server/activity"
import { db } from "@/server/db"

// Separate from PATCH /workbooks/[workbookId] (open to all members): who owns a sheet follows the
// staffing rules.
export const POST = withTeamStaffing(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, workbookId } = ctx.params
    if (!(await workbookBelongsToProject(workbookId!, projectId!))) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }

    const body = (await req.json().catch(() => ({}))) as { employeeId?: unknown }
    const employeeId =
      body.employeeId === null || body.employeeId === undefined || body.employeeId === ""
        ? null
        : body.employeeId
    if (employeeId !== null && typeof employeeId !== "string") {
      return NextResponse.json({ error: "employeeId must be an id or null" }, { status: 422 })
    }

    // The picker filters client-side; this enforces it (a stale tab mustn't pick someone who has left).
    let assignee: { firstName: string; lastName: string } | null = null
    if (employeeId) {
      assignee = await db.employee.findFirst({
        where: { id: employeeId, isActive: true, status: "ACTIVE" },
        select: { firstName: true, lastName: true },
      })
      if (!assignee) {
        return NextResponse.json(
          { error: "That person is no longer an active employee" },
          { status: 422 },
        )
      }
    }

    // A ticked service's calendar, this month or later, is owned by the service's owner: one
    // person, whether set here or in the services popup. Past months keep who ran them.
    const [book, project] = await Promise.all([
      db.projectWorkbook.findUnique({
        where: { id: workbookId },
        select: { service: true, periodMonth: true },
      }),
      db.project.findUnique({ where: { id: projectId }, select: { services: true } }),
    ])
    const from = parsePeriodMonth(currentPlanMonth())!
    const service =
      book?.service &&
      project?.services.includes(book.service) &&
      (!book.periodMonth || book.periodMonth >= from)
        ? book.service
        : null
    if (service) {
      try {
        await setServiceOwner(projectId!, service, employeeId)
      } catch (e) {
        if (e instanceof ServiceOwnerError) {
          return NextResponse.json({ error: e.message }, { status: 422 })
        }
        throw e
      }
    }

    const workbook = await assignWorkbook(workbookId!, employeeId)
    const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}`.trim() : null

    await logActivity({
      projectId: projectId!,
      actorId: session.user.id,
      type: "SHEET_ASSIGNED",
      entityType: "workbook",
      entityId: workbookId!,
      meta: { sheetName: workbook.name, assigneeName },
    })

    // Un-assigning notifies nobody; picking yourself neither.
    if (employeeId) {
      await notifyOwnerAssigned({
        projectId: projectId!,
        employeeId,
        actorId: session.user.id,
        service,
        calendar: { id: workbookId!, name: workbook.name },
      }).catch((e) => console.error("[SHEET_OWNER_NOTIFY]", e))
    }

    return NextResponse.json({ data: workbook })
  },
)
