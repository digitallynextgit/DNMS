"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"

/** A department as the Departments page manages it - inactive ones included. */
export interface AdminDepartment {
  id: string
  name: string
  parentId: string | null
  headId: string | null
  isActive: boolean
  /** Active people directly in it - what the directory lists. */
  activeEmployees: number
  /** Everything that still points at it; any of these blocks a hard delete. */
  _count: { employees: number; jobPostings: number; children: number }
}

// The admin list and every department dropdown (useDepartments) both change.
const INVALIDATE = [["departments-admin"], ["departments"]]

export function useDepartmentsAdmin() {
  return useQuery({
    queryKey: ["departments-admin"],
    queryFn: async () =>
      (await apiFetch<{ data: AdminDepartment[] }>("/api/departments?includeInactive=true")).data,
  })
}

/** Create (no `id`) or update a department; `parentId` places it in the tree. */
export function useSaveDepartment() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (body: { id?: string; name: string; parentId: string | null }) =>
        apiFetch(body.id ? `/api/departments/${body.id}` : "/api/departments", {
          method: body.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: body.name, parentId: body.parentId }),
        }),
      invalidate: INVALIDATE,
      success: (_d, v) => (v.id ? "Department updated" : "Department created"),
    }),
  )
}

/** Deactivating also deactivates everything under it; activating revives its parents. */
export function useSetDepartmentActive() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
        apiFetch(`/api/departments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        }),
      invalidate: INVALIDATE,
      success: (_d, v) => (v.isActive ? "Department activated" : "Department deactivated"),
    }),
  )
}

/** Permanent delete - the server refuses while anything still points at it. */
export function useDeleteDepartment() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (id: string) =>
        apiFetch(`/api/departments/${id}?permanent=true`, { method: "DELETE" }),
      invalidate: INVALIDATE,
      success: "Department deleted",
    }),
  )
}
