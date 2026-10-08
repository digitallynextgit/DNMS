"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import type { ImportInput } from "../schemas/stock.schema"

// Client-side row shapes (Dates arrive as ISO strings over JSON).
export interface StockItemRow {
  id: string
  name: string
  pricePerPiece: number | null
  purchasedQty: number
  issuedQty: number
  leftQty: number
  notes: string | null
}

export interface StockIssueRow {
  id: string
  holderName: string
  employeeId: string | null
  quantity: number
  issuedOn: string | null
  notes: string | null
  createdAt: string
  item: { id: string; name: string }
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNo: string
    isActive: boolean
    profilePhoto: string | null
  } | null
}

export interface LinkableEmployee {
  id: string
  firstName: string
  lastName: string
  employeeNo: string
  isActive: boolean
  profilePhoto: string | null
}

export interface ImportResult {
  itemsCreated: number
  itemsRestocked: number
  issuesCreated: number
  linked: number
  unlinked: number
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

const KEYS = {
  items: ["stock", "items"] as const,
  issues: (filters: { q: string; itemId: string; unlinkedOnly: boolean; page: number }) =>
    ["stock", "issues", filters] as const,
}

export function useStockItems() {
  return useQuery({
    queryKey: KEYS.items,
    queryFn: async () => (await apiFetch<{ data: StockItemRow[] }>("/api/stock/items")).data,
  })
}

export function useStockIssues(filters: {
  q: string
  itemId: string
  unlinkedOnly: boolean
  page: number
}) {
  const params = new URLSearchParams()
  if (filters.q) params.set("q", filters.q)
  if (filters.itemId && filters.itemId !== "all") params.set("itemId", filters.itemId)
  if (filters.unlinkedOnly) params.set("unlinked", "1")
  params.set("page", String(filters.page))
  return useQuery({
    queryKey: KEYS.issues(filters),
    queryFn: async () =>
      (
        await apiFetch<{ data: { rows: StockIssueRow[]; meta: PaginationMeta } }>(
          `/api/stock/issues?${params.toString()}`,
        )
      ).data,
  })
}

/** Employees for the link dialog - includes deactivated ones on purpose. */
export function useLinkableEmployees(q: string) {
  return useQuery({
    queryKey: ["stock", "linkable-employees", q],
    queryFn: async () =>
      (
        await apiFetch<{ data: LinkableEmployee[] }>(
          `/api/stock/employees?q=${encodeURIComponent(q)}`,
        )
      ).data,
  })
}

function useInvalidateStock() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ["stock"] })
}

export function useCreateStockItem() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (input: {
      name: string
      pricePerPiece?: number | null
      purchasedQty?: number
      notes?: string | null
    }) =>
      apiFetch("/api/stock/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateStockItem() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      apiFetch(`/api/stock/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

export function useCreateStockIssue() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (input: {
      itemId: string
      holderName: string
      employeeId?: string | null
      quantity: number
      issuedOn?: string | null
      notes?: string | null
    }) =>
      apiFetch("/api/stock/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateStockIssue() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      apiFetch(`/api/stock/issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteStockIssue() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/stock/issues/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
}

export interface StockMatrixRow {
  key: string
  holderName: string
  issuedOn: string | null
  employee: StockIssueRow["employee"]
  issueIds: string[]
  cells: Record<string, { quantity: number; issueIds: string[] }>
}

export function useStockMatrix(filters: {
  q: string
  itemId: string
  unlinkedOnly: boolean
  page: number
}) {
  const params = new URLSearchParams()
  if (filters.q) params.set("q", filters.q)
  if (filters.itemId && filters.itemId !== "all") params.set("itemId", filters.itemId)
  if (filters.unlinkedOnly) params.set("unlinked", "1")
  params.set("page", String(filters.page))
  return useQuery({
    queryKey: ["stock", "register", filters] as const,
    queryFn: async () =>
      (
        await apiFetch<{ data: { rows: StockMatrixRow[]; meta: PaginationMeta } }>(
          `/api/stock/register?${params.toString()}`,
        )
      ).data,
  })
}

export function useUpdateRegisterRow() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (input: {
      holderName: string
      employeeId: string | null
      issuedOn: string | null
      cells: { itemId: string; issueIds: string[]; quantity: number }[]
    }) =>
      apiFetch("/api/stock/register", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

export function useBulkStockIssues() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: async (input: {
      ids: string[]
      action: "link" | "unlink" | "delete"
      employeeId?: string
    }) =>
      (
        await apiFetch<{ data: { affected: number } }>("/api/stock/issues/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ).data,
    onSuccess: invalidate,
  })
}

export function useImportStock() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: async (input: ImportInput) =>
      (
        await apiFetch<{ data: ImportResult }>("/api/stock/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ).data,
    onSuccess: invalidate,
  })
}
