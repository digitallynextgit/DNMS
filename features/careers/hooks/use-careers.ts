"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { AdminCareerGroup } from "@/features/careers/careers.types"

const TREE_KEY = ["careers-tree"]

// ─── fetch helpers ───────────────────────────────────────────────────────────
async function post(url: string, body: unknown) {
  return (
    await apiFetch<{ data: unknown }>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).data
}
async function patch(url: string, body: unknown) {
  return (
    await apiFetch<{ data: unknown }>(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).data
}
async function del(url: string) {
  return (await apiFetch<{ data: { message: string } }>(url, { method: "DELETE" })).data
}

// ─── query ───────────────────────────────────────────────────────────────────
export function useCareersTree() {
  return useQuery({
    queryKey: TREE_KEY,
    queryFn: async () =>
      (await apiFetch<{ data: { data: AdminCareerGroup[] } }>("/api/careers")).data.data,
    staleTime: 30_000,
  })
}

// ─── mutation factory ──────────────────────────────────────────────────────────
function useCareerMutation<V>(fn: (vars: V) => Promise<unknown>, success: string) {
  const qc = useQueryClient()
  return useMutation(mutationWithToast(qc, { mutationFn: fn, invalidate: [TREE_KEY], success }))
}

// ─── Group ─────────────────────────────────────────────────────────────────────
export const useCreateGroup = () =>
  useCareerMutation((body: Record<string, unknown>) => post("/api/careers", body), "Group created")
export const useUpdateGroup = () =>
  useCareerMutation(
    ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch(`/api/careers/${id}`, body),
    "Group updated",
  )
export const useDeleteGroup = () =>
  useCareerMutation((id: string) => del(`/api/careers/${id}`), "Group deleted")

// ─── Sub-department ──────────────────────────────────────────────────────────
export const useCreateSubDepartment = () =>
  useCareerMutation(
    (body: Record<string, unknown>) => post("/api/careers/sub-departments", body),
    "Sub-department created",
  )
export const useUpdateSubDepartment = () =>
  useCareerMutation(
    ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch(`/api/careers/sub-departments/${id}`, body),
    "Sub-department updated",
  )
export const useDeleteSubDepartment = () =>
  useCareerMutation(
    (id: string) => del(`/api/careers/sub-departments/${id}`),
    "Sub-department deleted",
  )

// ─── Role ──────────────────────────────────────────────────────────────────────
export const useCreateRole = () =>
  useCareerMutation(
    (body: Record<string, unknown>) => post("/api/careers/roles", body),
    "Role created",
  )
export const useUpdateRole = () =>
  useCareerMutation(
    ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch(`/api/careers/roles/${id}`, body),
    "Role updated",
  )
export const useDeleteRole = () =>
  useCareerMutation((id: string) => del(`/api/careers/roles/${id}`), "Role deleted")

// ─── Opening ─────────────────────────────────────────────────────────────────
export const useCreateOpening = () =>
  useCareerMutation(
    (body: Record<string, unknown>) => post("/api/careers/openings", body),
    "Opening added",
  )
export const useUpdateOpening = () =>
  useCareerMutation(
    ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patch(`/api/careers/openings/${id}`, body),
    "Opening updated",
  )
export const useDeleteOpening = () =>
  useCareerMutation((id: string) => del(`/api/careers/openings/${id}`), "Opening removed")
