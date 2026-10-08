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

// Mutations refetch the whole sheet list: several people edit at once, and a refetch is how this
// client sees their changes. Cell writes are the exception (optimistic, in the grid).
const key = (projectId: string) => ["project-sheets", projectId] as const
const bookKey = (projectId: string, workbookId: string | null) =>
  ["project-workbook", projectId, workbookId] as const

/** The picker's list: names, months and tab names, no grids (it grows by twelve a year). */
export function useWorkbookIndex(projectId: string) {
  return useQuery({
    queryKey: key(projectId),
    queryFn: () => apiFetch<{ data: WorkbookIndexEntry[] }>(`/api/projects/${projectId}/workbooks`),
    enabled: Boolean(projectId),
    select: (r) => r.data,
  })
}

/** One calendar in full (tabs, columns, rows, team plan), keyed per workbook. */
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
  /** Refresh both the picker index and the open grid - most writes move one or the other. */
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: key(projectId) })
    void qc.invalidateQueries({ queryKey: ["project-workbook", projectId] })
  }
  const base = `/api/projects/${projectId}/sheets`

  const fail = (e: unknown, fallback: string) =>
    toast.error(e instanceof Error ? e.message : fallback)

  // Workbooks: what the UI calls a "sheet" - a named set of tabs.
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

  /** Put a team on this month's plan or change what it owes - one idempotent write for the row. */
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
      // Say what happened to the files: "removed" alone reads as "deleted".
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

  /** Not a useMutation: the grid already shows the value. Refetches quietly; only failures surface. */
  const saveCells = async (sheetId: string, position: number, cells: Record<string, unknown>) => {
    try {
      // Addressed by ROW POSITION: an untyped row has no id yet. The server upserts.
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

  /** Persist a column width / row height. No refetch, or the column would jump on mouse-up. */
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
      // A size that didn't stick isn't worth a toast.
    }
  }

  /** Append many rows (file importer); the server normalises values and skips empty rows. */
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
