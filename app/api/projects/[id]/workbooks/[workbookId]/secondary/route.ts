import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { db } from "@/server/db"
import { canManageProject, withProjectAccess } from "@/features/projects/server/project-access"
import {
  ServiceOwnerError,
  assertMayChangeServiceOwners,
  setServiceOwners,
} from "@/features/projects/server/project-service-owners"
import { setWorkbookSecondary } from "@/features/projects/server/sheets.service"
import { notifyOwnerAssigned } from "@/features/projects/server/owner-notifications"
import { logActivity } from "@/features/projects/server/activity"
import { isAdmin_Session } from "@/lib/audit"

// PUT { employeeId: "<id>" | null } - who covers this calendar for its manager, with the same powers.
// A service calendar's secondary is the service's secondary owner (set through the service, so every
// month of it follows); a custom calendar keeps its own, from this month on. The manager, an Account
// Manager or a project admin may set it.
export const PUT = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, workbookId } = ctx.params
    const book = await db.projectWorkbook.findFirst({
      where: { id: workbookId!, projectId: projectId! },
      select: { id: true, name: true, service: true, assignedToId: true },
    })
    if (!book) return NextResponse.json({ error: "Calendar not found" }, { status: 404 })

    const body = (await req.json().catch(() => ({}))) as { employeeId?: unknown }
    const employeeId =
      typeof body.employeeId === "string" && body.employeeId ? body.employeeId : null
    if (body.employeeId !== undefined && body.employeeId !== null && !employeeId) {
      return NextResponse.json({ error: "employeeId must be an id or null" }, { status: 422 })
    }

    const project = await db.project.findUnique({
      where: { id: projectId! },
      select: { services: true },
    })
    const service = book.service && project?.services.includes(book.service) ? book.service : null

    try {
      if (service) {
        await assertMayChangeServiceOwners(session, projectId!, service, { secondary: employeeId })
        const assigned = await setServiceOwners(projectId!, service, { secondary: employeeId })
        for (const a of assigned) {
          await notifyOwnerAssigned({
            projectId: projectId!,
            employeeId: a.employeeId,
            actorId: session.user.id,
            silentActor: isAdmin_Session(session),
            service,
            secondary: a.secondary,
          }).catch((e) => console.error("[CALENDAR_SECONDARY_NOTIFY]", e))
        }
      } else {
        const mayChange =
          book.assignedToId === session.user.id || (await canManageProject(session, projectId!))
        if (!mayChange) {
          return NextResponse.json(
            {
              error:
                "Only the calendar's owner, an Account Manager or a project admin can choose its secondary.",
            },
            { status: 403 },
          )
        }
        if (employeeId) {
          if (!book.assignedToId) {
            return NextResponse.json(
              { error: "Choose the calendar's owner before a secondary." },
              { status: 422 },
            )
          }
          if (employeeId === book.assignedToId) {
            return NextResponse.json(
              { error: "The secondary must be someone other than the calendar's owner." },
              { status: 422 },
            )
          }
          const person = await db.employee.findFirst({
            where: { id: employeeId, isActive: true, status: "ACTIVE" },
            select: { id: true },
          })
          if (!person) {
            return NextResponse.json(
              { error: "That person is no longer an active employee" },
              { status: 422 },
            )
          }
        }
        await setWorkbookSecondary(book.id, employeeId)
        if (employeeId) {
          await notifyOwnerAssigned({
            projectId: projectId!,
            employeeId,
            actorId: session.user.id,
            silentActor: isAdmin_Session(session),
            calendar: { id: book.id, name: book.name },
            secondary: true,
          }).catch((e) => console.error("[CALENDAR_SECONDARY_NOTIFY]", e))
        }
      }
    } catch (e) {
      if (e instanceof ServiceOwnerError) {
        return NextResponse.json({ error: e.message }, { status: e.status })
      }
      throw e
    }

    const updated = await db.projectWorkbook.findUnique({
      where: { id: book.id },
      select: {
        secondaryAssignedTo: {
          select: { id: true, firstName: true, lastName: true, profilePhoto: true },
        },
      },
    })
    const secondaryOwner = updated?.secondaryAssignedTo ?? null

    await logActivity({
      projectId: projectId!,
      actorId: session.user.id,
      type: "SHEET_ASSIGNED",
      entityType: "workbook",
      entityId: book.id,
      meta: {
        sheetName: book.name,
        secondary: true,
        assigneeName: secondaryOwner
          ? `${secondaryOwner.firstName} ${secondaryOwner.lastName}`.trim()
          : null,
      },
    })

    return NextResponse.json({ data: { secondaryOwner } })
  },
)
