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

// =============================================================================
// Calendars, from the CLIENT side.
// =============================================================================
// The same sheets the team fills on the project's Calendars tab - not a copy,
// not a parallel table. A calendar the client edits here is the calendar the
// account manager is looking at.
//
// What differs is WHICH ones and HOW MUCH:
//
//   which  only calendars staff ticked as shared. A project's calendars include
//          internal working sheets, so `listClientWorkbooks` filters on the
//          share flag and the portal never calls the unfiltered `listWorkbooks`.
//   how    fill a cell, and start a calendar of their own. Nothing else - no
//          columns, no renaming, no deleting, no import, no assignment. Those
//          are absent from this file entirely rather than guarded inside it,
//          which is the difference between a surface that is small and one
//          that is merely careful.
//
// Every entry point starts with requireClientModule(projectRef, "calendars"),
// which re-proves the session, the grant and the module. The projectRef in the
// URL is a lookup key, never an authorisation: queries filter on grant.projectId.
//
// ── THE GUARD THE WRITES NEED ────────────────────────────────────────────────
// `sheetBelongsToProject` is what the staff routes use and is NOT enough here:
// it would accept a sheet from an UNSHARED calendar on the same project, which
// is precisely what the share flag exists to stop. The cell write below
// therefore asks `sheetIsClientVisible`, which checks the project AND the flag.
// =============================================================================

/**
 * The shared calendars for one project, each with its tabs, columns and rows.
 *
 * `canDelete` is resolved HERE rather than shipped as an owner id for the
 * browser to compare against itself: the browser does not know who it is, and a
 * rule it could compute is a rule it could get wrong. The server answers the
 * question it already has the session for, and the API refuses anyway.
 */
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

/**
 * Delete a calendar the client started.
 *
 * ONLY one they started. A shared calendar is the team's working document that
 * happens to be visible here, and deleting it would take every tab, row and
 * history entry in it with them - so the answer to "I do not want to see this
 * one" is for the team to un-tick the share, not for the portal to offer a bin
 * over somebody else's work.
 *
 * Ownership is read from the workbook's own column, not from who can currently
 * see it: two people at the same client both have this calendar on their list,
 * and only the one who started it may remove it.
 */
export async function deleteClientCalendar(
  projectRef: string,
  workbookId: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { session, grant } = await requireClientModule(projectRef, "calendars")

    const workbook = await getClientVisibleWorkbook(workbookId, grant.projectId)
    // A calendar on another project, or one never shared, reads exactly like one
    // that is not there - the portal must not confirm what it cannot show.
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

/** The longest a client may make a calendar name. Matches the staff dialog. */
const MAX_NAME = 120

/**
 * Create a calendar of their own.
 *
 * Born SHARED (`isClientVisible: true`) - a calendar somebody made for
 * themselves that they then could not see would be absurd, and the flag is the
 * only thing that puts it on their list. It is an ordinary calendar on the
 * project either way: the team sees it on the Calendars tab beside their own,
 * can rename or withdraw it, and nothing about it is portal-only.
 *
 * It opens as the same blank A-Z grid the team gets from "New sheet". The
 * client cannot rename those columns - column editing stays staff-only, here as
 * everywhere - so a calendar they need headed properly is one to ask the team
 * about. That is a deliberate trade for keeping one rule about columns rather
 * than two.
 */
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
      // The table is unique on (projectId, name), and the client cannot see the
      // team's internal calendars - so "that name is taken" has to be said
      // plainly rather than surfaced as a database error about a row they
      // cannot look at.
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

/**
 * Write cells at a row POSITION, creating the row if it is not there yet.
 *
 * Addressed by position rather than row id for the same reason the staff route
 * is: the grid draws far more rows than exist, and the browser cannot know an
 * id for a row nobody has typed into.
 */
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

    // A sheet on an unshared calendar - or on a different one from the calendar
    // in the URL - reads exactly like one that is not there.
    if (!(await sheetIsClientVisible(sheetId, grant.projectId, workbookId))) {
      return fail("Calendar not found", undefined, 404)
    }

    // null employee + the client's id: see addRow/writeCellsAt in the sheets
    // service for why the two actors cannot share a column.
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

// There is deliberately NO "add row" entry point. The grid offers a hundred row
// positions and `writeCellsAt` creates the row the first time something lands in
// one, so appending an empty row is not a thing anyone needs to ask for - and an
// endpoint that exists only to make blank rows is an endpoint for making blank
// rows a thousand at a time.
