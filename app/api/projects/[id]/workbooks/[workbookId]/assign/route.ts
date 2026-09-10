import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withTeamStaffing } from "@/features/projects/server/project-access"
import { assignWorkbook, workbookBelongsToProject } from "@/features/projects/server/sheets.service"
import { logActivity } from "@/features/projects/server/activity"
import { createNotification } from "@/lib/notifications"
import { db } from "@/server/db"

/**
 * POST - hand a workbook ("sheet" in the UI) to someone, or to nobody.
 *   body { employeeId: string | null }
 *
 * Its own route rather than another field on PATCH /workbooks/[workbookId]:
 * that one is withProjectAccess because renaming a sheet is open to everyone
 * working on the project, and deciding who OWNS it is not. Staffing rules
 * apply instead - the Account Manager, a project admin, or a team manager.
 */
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

    // The picker is filtered client-side; this is what actually enforces it. A
    // stale tab must not be able to hand a sheet to someone who has left.
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

    // Only the person picked up needs telling, and only when they did not do
    // it themselves. Un-assigning notifies nobody: there is no new owner.
    if (employeeId && employeeId !== session.user.id) {
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      })
      await createNotification({
        employeeId,
        title: "Sheet assigned to you",
        message: `You now own the sheet "${workbook.name}" in ${project?.name ?? "a project"}.`,
        type: "info",
        link: `/projects/${projectId}?tab=calendar`,
      })
    }

    return NextResponse.json({ data: workbook })
  },
)
