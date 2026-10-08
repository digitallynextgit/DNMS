import "server-only"

import { requireClientModule } from "@/server/client-guard"
import { recordActivity } from "@/lib/activity"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import {
  listClientWorkbooks,
  getClientVisibleWorkbook,
  sheetIsClientVisible,
  createWorkbook,
  deleteWorkbook,
  writeCellsAt,
} from "@/features/projects/server/sheets.service"

// Shared calendars from the client side: fill cells and start their own, nothing else.
// Writes must use sheetIsClientVisible - sheetBelongsToProject would accept an unshared calendar.

/** Shared calendars for one project. `canDelete` is resolved here, not by the browser. */
export async function listClientCalendars(projectRef: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "calendars")
    const workbooks = (await listClientWorkbooks(grant.projectId)).map((w) => ({
      ...w,
      canDelete: w.createdByClientId === session.user.id,
    }))
    return ok(serialize({ data: { workbooks, projectName: grant.projectName } }))
  })
}

/** Delete a calendar the client started. Only its creator - never a shared team calendar. */
export async function deleteClientCalendar(
  projectRef: string,
  workbookId: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "calendars")

    const workbook = await getClientVisibleWorkbook(workbookId, grant.projectId)
    // Another project's or an unshared calendar reads as not found.
    if (!workbook) return fail("Calendar not found", undefined, 404)

    if (workbook.createdByClientId !== session.user.id) {
      return fail(
        "This calendar belongs to the team. Ask them to remove it, or to stop sharing it with you.",
        undefined,
        403,
      )
    }

    await deleteWorkbook(workbook.id)

    await recordActivity(session, {
      action: "calendar:delete",
      module: "project",
      entityType: "ProjectWorkbook",
      entityId: workbook.id,
      summary: `Deleted the calendar "${workbook.name}"`,
      projectId: grant.projectId,
    })

    return ok(serialize({ data: { id: workbook.id } }))
  })
}

/** Matches the staff dialog. */
const MAX_NAME = 120

/** Create a client calendar. Born shared so it shows on their list; columns stay staff-only. */
export async function createClientCalendar(
  projectRef: string,
  body: unknown,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "calendars")

    const name =
      typeof (body as { name?: unknown })?.name === "string"
        ? (body as { name: string }).name.trim()
        : ""
    if (!name) return fail("Give the calendar a name", undefined, 422)
    if (name.length > MAX_NAME) {
      return fail(`Keep the name under ${MAX_NAME} characters`, undefined, 422)
    }

    let workbook
    try {
      workbook = await createWorkbook(grant.projectId, null, {
        name,
        isClientVisible: true,
        actorClientId: session.user.id,
      })
    } catch (e) {
      // Names are unique per project and internal calendars are hidden, so say it plainly.
      const clash = e instanceof Error && e.message.toLowerCase().includes("unique")
      return fail(
        clash ? "A calendar with that name already exists on this project" : "Could not create it",
        undefined,
        422,
      )
    }

    await recordActivity(session, {
      action: "calendar:create",
      module: "project",
      entityType: "ProjectWorkbook",
      entityId: workbook.id,
      summary: `Created the calendar "${name}"`,
      projectId: grant.projectId,
    })

    return ok(serialize({ data: { workbook } }))
  })
}

/** Write cells at a row position, creating the row - the grid draws rows that don't exist yet. */
export async function writeClientCalendarCells(
  projectRef: string,
  workbookId: string,
  sheetId: string,
  body: unknown,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "calendars")

    const input = body as { position?: unknown; cells?: unknown }
    if (
      typeof input.position !== "number" ||
      !Number.isInteger(input.position) ||
      input.position < 0
    ) {
      return fail("A row position is required", undefined, 422)
    }
    if (!input.cells || typeof input.cells !== "object" || Array.isArray(input.cells)) {
      return fail("Nothing to update", undefined, 400)
    }

    // An unshared calendar's sheet, or one from another calendar, reads as not found.
    if (!(await sheetIsClientVisible(sheetId, grant.projectId, workbookId))) {
      return fail("Calendar not found", undefined, 404)
    }

    // The client actor goes in its own column, not the employee one.
    await writeCellsAt(
      sheetId,
      input.position,
      null,
      input.cells as Record<string, unknown>,
      session.user.id,
    )

    await recordActivity(session, {
      action: "calendar:edit",
      module: "project",
      entityType: "ProjectSheet",
      entityId: sheetId,
      summary: `Edited a calendar on ${grant.projectName}`,
      projectId: grant.projectId,
    })

    return ok(serialize({ data: { sheetId } }))
  })
}

// No "add row" endpoint on purpose: writeCellsAt creates a row on its first write.
