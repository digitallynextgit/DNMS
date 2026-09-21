"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api-fetch"
import type { WorkbookTeamStatus } from "../lib/workbook-team-progress"
import type {
  ProjectSheet,
  SheetColumnType,
  SheetEvent,
  SheetWorkbook,
  StaffWorkbook,
  WorkbookIndexEntry,
  WorkbookTeam,
} from "../lib/sheet-types"

/**
 * Project sheets.
 *
 * Every mutation invalidates the whole sheet list rather than patching a cell in
 * place. A sheet is edited by several people at once, so a refetch is also how
 * this client finds out what everyone else did - a surgical cache update would
 * keep the screen consistent with itself and wrong about the sheet.
 *
 * Cell writes are the exception, and are handled in the grid: those are
 * optimistic locally and reconciled on the next refetch, because a round-trip
 * per keystroke-commit would make typing feel broken.
 */
const key = (projectId: string) => ["project-sheets", projectId] as const
/** One edition's grid and plan. Separate from the index - see useWorkbook. */
const bookKey = (projectId: string, workbookId: string | null) =>
  ["project-workbook", projectId, workbookId] as const

/**
 * The PICKER's list: every calendar on the project, named and dated, with tab
 * names but no columns and no rows.
 *
 * Light on purpose. A calendar now has one edition per MONTH, so this list
 * grows by twelve a year per calendar; carrying each one's grid would make
 * opening the Calendars tab cost more every month the project runs. The open
 * edition is fetched on its own by useWorkbook.
 */
export function useWorkbookIndex(projectId: string) {
  return useQuery({
    queryKey: key(projectId),
    queryFn: () => apiFetch<{ data: WorkbookIndexEntry[] }>(`/api/projects/${projectId}/workbooks`),
    enabled: Boolean(projectId),
    select: (r) => r.data,
  })
}

/**
 * ONE calendar in full: tabs, columns, rows, and the team plan.
 *
 * Keyed on the workbook, so stepping from September to October is a fresh
 * fetch of October rather than a re-read of every month the project has.
 */
export function useWorkbook(projectId: string, workbookId: string | null) {
  return useQuery({
    queryKey: bookKey(projectId, workbookId),
    queryFn: () =>
      apiFetch<{ data: StaffWorkbook }>(`/api/projects/${projectId}/workbooks/${workbookId}`),
    enabled: Boolean(projectId && workbookId),
    select: (r) => r.data,
  })
}

export function useSheetHistory(projectId: string, sheetId: string | null) {
  return useQuery({
    queryKey: ["project-sheet-history", projectId, sheetId],
    queryFn: () =>
      apiFetch<{ data: SheetEvent[] }>(`/api/projects/${projectId}/sheets/${sheetId}/history`),
    enabled: Boolean(projectId && sheetId),
    select: (r) => r.data,
  })
}

const json = { "Content-Type": "application/json" }

export function useSheetMutations(projectId: string) {
  const qc = useQueryClient()
  /**
   * Refresh both reads.
   *
   * The index draws the picker and the detail draws the grid, and almost every
   * write moves one or the other - renaming a calendar changes the picker,
   * adding a tab changes the grid, creating a month changes both. Refreshing
   * the pair is one round trip more than the minimum and removes a whole class
   * of "the dropdown still says the old name" bug.
   */
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: key(projectId) })
    void qc.invalidateQueries({ queryKey: ["project-workbook", projectId] })
  }
  const base = `/api/projects/${projectId}/sheets`

  const fail = (e: unknown, fallback: string) =>
    toast.error(e instanceof Error ? e.message : fallback)

  // ── Workbooks: what the UI calls a "sheet" - a named set of tabs ────────────
  const workbooks = `/api/projects/${projectId}/workbooks`

  const createWorkbook = useMutation({
    mutationFn: (body: {
      name: string
      firstTab?: string
      /** "2026-09" / "2026-09-01". Omitted = a calendar with no month. */
      periodMonth?: string | null
      /** Start this month from an existing edition. Rows are never copied. */
      copyFrom?: { workbookId: string; structure?: boolean; teamPlan?: boolean } | null
    }) =>
      apiFetch<{ data: SheetWorkbook }>(workbooks, {
        method: "POST",
        headers: json,
        body: JSON.stringify(body),
      }).then((r) => r.data),
    onSuccess: () => {
      void invalidate()
      toast.success("Sheet created")
    },
    onError: (e) => fail(e, "Could not create the sheet"),
  })

  const renameWorkbook = useMutation({
    mutationFn: ({ workbookId, name }: { workbookId: string; name: string }) =>
      apiFetch(`${workbooks}/${workbookId}`, {
        method: "PATCH",
        headers: json,
        body: JSON.stringify({ name }),
      }),
    onSuccess: invalidate,
    onError: (e) => fail(e, "Could not rename the sheet"),
  })

  /** Publish a calendar to the client portal, or withdraw it. Managers only. */
  const shareWorkbook = useMutation({
    mutationFn: ({
      workbookId,
      isClientVisible,
    }: {
      workbookId: string
      isClientVisible: boolean
    }) =>
      apiFetch(`${workbooks}/${workbookId}/share`, {
        method: "PATCH",
        headers: json,
        body: JSON.stringify({ isClientVisible }),
      }),
    onSuccess: (_res, vars) => {
      void invalidate()
      toast.success(
        vars.isClientVisible
          ? "Shared with the client - they can now fill this calendar in"
          : "Withdrawn - the client can no longer see this calendar",
      )
    },
    onError: (e) => fail(e, "Could not change who can see this sheet"),
  })

  const assignWorkbook = useMutation({
    mutationFn: ({ workbookId, employeeId }: { workbookId: string; employeeId: string | null }) =>
      apiFetch<{ data: SheetWorkbook }>(`${workbooks}/${workbookId}/assign`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ employeeId }),
      }),
    onSuccess: (res) => {
      void invalidate()
      const who = res.data.assignedTo
      toast.success(
        who
          ? `"${res.data.name}" assigned to ${who.firstName} ${who.lastName}`.trim()
          : `"${res.data.name}" is now unassigned`,
      )
    },
    onError: (e) => fail(e, "Could not assign the sheet"),
  })

  /** Give an edition a month, move it, or clear it. Managers, via the picker. */
  const setWorkbookMonth = useMutation({
    mutationFn: ({ workbookId, periodMonth }: { workbookId: string; periodMonth: string | null }) =>
      apiFetch<{ data: SheetWorkbook }>(`${workbooks}/${workbookId}`, {
        method: "PATCH",
        headers: json,
        body: JSON.stringify({ periodMonth }),
      }),
    onSuccess: () => {
      void invalidate()
      toast.success("Month updated")
    },
    onError: (e) => fail(e, "Could not set the month"),
  })

  /**
   * Put a team on this month's plan, or change what it owes. Idempotent, and
   * one write for the whole row - quantity, due date, links, notes, people -
   * because that is how the form is filled in.
   */
  const saveTeamPlan = useMutation({
    mutationFn: ({
      workbookId,
      teamId,
      ...body
    }: {
      workbookId: string
      teamId: string
      quantity?: number | null
      dueOn?: string | null
      links?: string[]
      notes?: string | null
      employeeIds?: string[]
      status?: WorkbookTeamStatus
    }) =>
      apiFetch<{ data: WorkbookTeam }>(`${workbooks}/${workbookId}/teams/${teamId}`, {
        method: "PUT",
        headers: json,
        body: JSON.stringify(body),
      }).then((r) => r.data),
    onSuccess: () => void invalidate(),
    onError: (e) => fail(e, "Could not save that team's plan"),
  })

  const removeTeamPlan = useMutation({
    mutationFn: ({ workbookId, teamId }: { workbookId: string; teamId: string }) =>
      apiFetch<{ success: true; detachedFiles: number }>(
        `${workbooks}/${workbookId}/teams/${teamId}`,
        { method: "DELETE" },
      ),
    onSuccess: (res) => {
      void invalidate()
      // Say what happened to the files, because "removed" on its own reads as
      // "deleted" and somebody will go looking for them.
      toast.success(
        res.detachedFiles > 0
          ? `Team removed. ${res.detachedFiles} file${res.detachedFiles === 1 ? "" : "s"} stayed in Files.`
          : "Team removed from this month",
      )
    },
    onError: (e) => fail(e, "Could not remove that team"),
  })

  const deleteWorkbook = useMutation({
    mutationFn: (workbookId: string) =>
      apiFetch(`${workbooks}/${workbookId}`, { method: "DELETE" }),
    onSuccess: () => {
      void invalidate()
      toast.success("Sheet deleted")
    },
    onError: (e) => fail(e, "Could not delete the sheet"),
  })

  // ── Tabs: one grid inside a workbook ────────────────────────────────────────
  const createSheet = useMutation({
    mutationFn: (body: { workbookId: string; name: string; description?: string }) =>
      apiFetch<{ data: ProjectSheet }>(base, {
        method: "POST",
        headers: json,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void invalidate()
      toast.success("Tab created")
    },
    onError: (e) => fail(e, "Could not create the tab"),
  })

  const renameSheet = useMutation({
    mutationFn: ({ sheetId, ...body }: { sheetId: string; name?: string; description?: string }) =>
      apiFetch(`${base}/${sheetId}`, {
        method: "PATCH",
        headers: json,
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
    onError: (e) => fail(e, "Could not rename the tab"),
  })

  const deleteSheet = useMutation({
    mutationFn: (sheetId: string) => apiFetch(`${base}/${sheetId}`, { method: "DELETE" }),
    onSuccess: () => {
      void invalidate()
      toast.success("Tab deleted")
    },
    onError: (e) => fail(e, "Could not delete the tab"),
  })

  const addColumn = useMutation({
    mutationFn: ({
      sheetId,
      ...body
    }: {
      sheetId: string
      name: string
      type: SheetColumnType
      options?: string[]
    }) =>
      apiFetch(`${base}/${sheetId}/columns`, {
        method: "POST",
        headers: json,
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
    onError: (e) => fail(e, "Could not add the column"),
  })

  const updateColumn = useMutation({
    mutationFn: ({
      sheetId,
      columnId,
      ...body
    }: {
      sheetId: string
      columnId: string
      name?: string
      type?: SheetColumnType
      options?: string[]
      width?: number | null
    }) =>
      apiFetch(`${base}/${sheetId}/columns/${columnId}`, {
        method: "PATCH",
        headers: json,
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
    onError: (e) => fail(e, "Could not update the column"),
  })

  const deleteColumn = useMutation({
    mutationFn: ({ sheetId, columnId }: { sheetId: string; columnId: string }) =>
      apiFetch(`${base}/${sheetId}/columns/${columnId}`, { method: "DELETE" }),
    onSuccess: () => {
      void invalidate()
      toast.success("Column deleted")
    },
    onError: (e) => fail(e, "Could not delete the column"),
  })

  const addRow = useMutation({
    mutationFn: (sheetId: string) => apiFetch(`${base}/${sheetId}/rows`, { method: "POST" }),
    onSuccess: invalidate,
    onError: (e) => fail(e, "Could not add the row"),
  })

  const deleteRow = useMutation({
    mutationFn: ({ sheetId, rowId }: { sheetId: string; rowId: string }) =>
      apiFetch(`${base}/${sheetId}/rows/${rowId}`, { method: "DELETE" }),
    onSuccess: () => {
      void invalidate()
      toast.success("Row deleted")
    },
    onError: (e) => fail(e, "Could not delete the row"),
  })

  /**
   * Write cells.
   *
   * Deliberately NOT a useMutation: the grid already shows the new value, so
   * there is nothing to await and no pending state worth rendering. It refetches
   * quietly afterwards to pick up anyone else's edits, and only surfaces
   * anything if the write actually failed - in which case the refetch is what
   * puts the true value back on screen.
   */
  const saveCells = async (sheetId: string, position: number, cells: Record<string, unknown>) => {
    try {
      // Addressed by ROW POSITION, not id: the grid draws a thousand rows and
      // only the typed-in ones exist, so the client cannot know an id for a row
      // it is about to bring into being. The server upserts.
      await apiFetch(`${base}/${sheetId}/cells`, {
        method: "PATCH",
        headers: json,
        body: JSON.stringify({ position, cells }),
      })
    } catch (e) {
      fail(e, "That change was not saved")
    } finally {
      void invalidate()
    }
  }

  /**
   * Persist a column width or a row height.
   *
   * Not a useMutation and not invalidating: the grid has already moved, and a
   * refetch on every mouse-up would make the column jump as the server's copy
   * arrives. The next natural refetch reconciles it.
   */
  const saveLayout = async (
    sheetId: string,
    body:
      | { rowHeight: { position: number; height: number } }
      | { columnWidth: { columnId: string; width: number } },
  ) => {
    try {
      await apiFetch(`${base}/${sheetId}/layout`, {
        method: "PATCH",
        headers: json,
        body: JSON.stringify(body),
      })
    } catch {
      // A size that did not stick is a cosmetic loss, and a toast on a drag is
      // worse than the problem.
    }
  }

  /**
   * Append many rows at once (the file importer). Cells are keyed by column id;
   * the server normalises values and skips fully empty rows.
   */
  const importRows = useMutation({
    mutationFn: ({ sheetId, rows }: { sheetId: string; rows: Record<string, unknown>[] }) =>
      apiFetch<{ data: { imported: number; firstPosition: number } }>(`${base}/${sheetId}/import`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ rows }),
      }).then((r) => r.data),
    onSuccess: () => void invalidate(),
    onError: (e) => fail(e, "Could not import the rows"),
  })

  return {
    importRows,
    createWorkbook,
    renameWorkbook,
    setWorkbookMonth,
    saveTeamPlan,
    removeTeamPlan,
    assignWorkbook,
    shareWorkbook,
    deleteWorkbook,
    createSheet,
    renameSheet,
    deleteSheet,
    addColumn,
    updateColumn,
    deleteColumn,
    addRow,
    deleteRow,
    saveCells,
    saveLayout,
  }
}
