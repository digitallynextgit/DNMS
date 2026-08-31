"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api-fetch"
import type { ProjectSheet, SheetColumnType, SheetEvent } from "../lib/sheet-types"

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

export function useProjectSheets(projectId: string) {
  return useQuery({
    queryKey: key(projectId),
    queryFn: () => apiFetch<{ data: ProjectSheet[] }>(`/api/projects/${projectId}/sheets`),
    enabled: Boolean(projectId),
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
  const invalidate = () => qc.invalidateQueries({ queryKey: key(projectId) })
  const base = `/api/projects/${projectId}/sheets`

  const fail = (e: unknown, fallback: string) =>
    toast.error(e instanceof Error ? e.message : fallback)

  const createSheet = useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      apiFetch<{ data: ProjectSheet }>(base, {
        method: "POST",
        headers: json,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void invalidate()
      toast.success("Sheet created")
    },
    onError: (e) => fail(e, "Could not create the sheet"),
  })

  const renameSheet = useMutation({
    mutationFn: ({ sheetId, ...body }: { sheetId: string; name?: string; description?: string }) =>
      apiFetch(`${base}/${sheetId}`, {
        method: "PATCH",
        headers: json,
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
    onError: (e) => fail(e, "Could not rename the sheet"),
  })

  const deleteSheet = useMutation({
    mutationFn: (sheetId: string) => apiFetch(`${base}/${sheetId}`, { method: "DELETE" }),
    onSuccess: () => {
      void invalidate()
      toast.success("Sheet deleted")
    },
    onError: (e) => fail(e, "Could not delete the sheet"),
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

  return {
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
