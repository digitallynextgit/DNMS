"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type {
  ChecklistDetail,
  ChecklistKind,
  ChecklistListRow,
  ChecklistStatus,
  MyChecklistItem,
} from "../types"

interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

// ── READING THE ENVELOPE ─────────────────────────────────────────────────────
// A service returning `ok(serialize({ data: rows }))` reaches the client as
//
//     { success: true, data: { data: rows } }
//
// because respond() puts ActionResult.data under `data`, and the service had
// already wrapped its payload in a `data` key of its own. The array is at
// `.data.data`, NOT `.data` - unwrapping one level too few hands the component
// an object, which fails as "filter is not a function" rather than as a type
// error, because apiFetch's generic is an assertion and nothing checks it.
//
// getMyPendingItemCount returns `ok({ count })` with no inner wrapper, so its
// value is at `.data.count` - the same trap, one level shallower.
//
// features/leave/hooks/use-leave.ts spells the nesting out the same way.

const KEY = {
  list: (kind: ChecklistKind, status: string, page: number, search: string) =>
    ["hr-checklists", kind, status, page, search] as const,
  detail: (id: string) => ["hr-checklists", "detail", id] as const,
  mine: ["clearances", "mine"] as const,
  mineCount: ["clearances", "count"] as const,
}

/**
 * Everything a checklist mutation must refresh.
 *
 * Ticking one item changes the list's progress bar, the detail, the signer's
 * own inbox and the sidebar badge. Invalidating the roots rather than naming
 * each key means a new screen reading this data is covered without a new entry
 * here being remembered.
 */
const INVALIDATE_ALL = [["hr-checklists"], ["clearances"]] as const

export function useChecklists(
  kind: ChecklistKind,
  opts: { status?: string; page?: number; search?: string } = {},
) {
  const status = opts.status ?? "IN_PROGRESS"
  const page = opts.page ?? 1
  const search = opts.search ?? ""
  return useQuery({
    queryKey: KEY.list(kind, status, page, search),
    queryFn: async () => {
      const params = new URLSearchParams({ kind, status, page: String(page) })
      if (search.trim()) params.set("search", search.trim())
      return (
        await apiFetch<{ data: { data: ChecklistListRow[]; pagination: PaginationMeta } }>(
          `/api/hr-checklists?${params}`,
        )
      ).data
    },
    staleTime: 30_000,
  })
}

export function useChecklist(id: string | undefined) {
  return useQuery({
    queryKey: KEY.detail(id ?? ""),
    queryFn: async () =>
      (await apiFetch<{ data: { data: ChecklistDetail } }>(`/api/hr-checklists/${id}`)).data.data,
    enabled: !!id,
    staleTime: 15_000,
  })
}

/**
 * The caller's outstanding items.
 *
 * No poll. This changes when the viewer acts on it, and every mutation below
 * invalidates the key - a background poll would be asking a question it already
 * has the answer to.
 */
export function useMyClearances() {
  return useQuery({
    queryKey: KEY.mine,
    queryFn: async () =>
      (await apiFetch<{ data: { data: MyChecklistItem[] } }>("/api/clearances")).data.data,
    staleTime: 30_000,
  })
}

export function useMyClearanceCount() {
  return useQuery({
    queryKey: KEY.mineCount,
    queryFn: async () =>
      (await apiFetch<{ data: { count: number } }>("/api/clearances/count")).data.count,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useSetItemDone() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (vars: { itemId: string; done: boolean; note?: string }) =>
        apiFetch(`/api/hr-checklists/items/${vars.itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done: vars.done, note: vars.note ?? "" }),
        }),
      invalidate: INVALIDATE_ALL.map((k) => [...k]),
      success: (_d, vars) => (vars.done ? "Marked done" : "Reopened"),
    }),
  )
}

export function useReassignItem() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (vars: { itemId: string; assigneeId: string | null }) =>
        apiFetch(`/api/hr-checklists/items/${vars.itemId}/assignee`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assigneeId: vars.assigneeId }),
        }),
      invalidate: INVALIDATE_ALL.map((k) => [...k]),
      success: "Reassigned",
    }),
  )
}

export function useAddChecklistItem(instanceId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (body: Record<string, unknown>) =>
        apiFetch(`/api/hr-checklists/${instanceId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: INVALIDATE_ALL.map((k) => [...k]),
      success: "Item added",
    }),
  )
}

export function useStartChecklist() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (vars: { employeeId: string; kind: ChecklistKind }) =>
        apiFetch<{ data: { id: string } }>("/api/hr-checklists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vars),
        }),
      invalidate: INVALIDATE_ALL.map((k) => [...k]),
      success: "Checklist started",
    }),
  )
}

export function useCompleteOnboarding() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (instanceId: string) =>
        apiFetch(`/api/hr-checklists/${instanceId}/complete`, { method: "POST" }),
      invalidate: INVALIDATE_ALL.map((k) => [...k]),
      success: "Onboarding completed",
    }),
  )
}

export function useCancelChecklist() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (vars: { instanceId: string; reason?: string }) =>
        apiFetch(`/api/hr-checklists/${vars.instanceId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: vars.reason ?? "" }),
        }),
      invalidate: INVALIDATE_ALL.map((k) => [...k]),
      success: "Checklist cancelled",
    }),
  )
}

// ─── Exit clearance ──────────────────────────────────────────────────────────

export interface ServingNoticeRow {
  resignationId: string
  resignedOn: string
  lastWorkingDate: string | null
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNo: string
    profilePhoto: string | null
    lastWorkingDate: string | null
    designation: { title: string } | null
    department: { name: string } | null
    manager: { id: string; firstName: string; lastName: string } | null
  }
  checklist: {
    id: string
    status: ChecklistStatus
    total: number
    done: number
    clearancesTotal: number
    clearancesDone: number
    blocking: { id: string; text: string }[]
  } | null
}

/** Everyone serving notice, with what is blocking each relieving. */
export function useServingNotice() {
  return useQuery({
    queryKey: ["exit-clearance", "serving-notice"],
    queryFn: async () =>
      (await apiFetch<{ data: { data: ServingNoticeRow[] } }>("/api/exit-clearance/serving-notice"))
        .data.data,
    staleTime: 60_000,
  })
}

/**
 * HR's final sign-off. Issues relieving and closes the account.
 *
 * The server refuses with 409 and names the outstanding clearances, so the
 * error toast tells HR what to chase rather than only that it failed.
 */
export function useCompleteExit() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (instanceId: string) =>
        apiFetch(`/api/hr-checklists/${instanceId}/complete-exit`, { method: "POST" }),
      invalidate: [["hr-checklists"], ["clearances"], ["exit-clearance"]],
      success: "Exit completed - relieving issued and access ended",
    }),
  )
}
