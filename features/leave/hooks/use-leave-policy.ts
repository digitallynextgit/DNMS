"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"

export interface PolicyLeaveType {
  id: string
  name: string
  code: string
  maxDaysPerYear: number
  accrualMethod: "MONTHLY" | "UPFRONT"
}

export interface PolicyCell {
  id: string
  employmentType: string
  leaveTypeId: string
  daysPerYear: number
}

export interface LeavePolicyData {
  types: PolicyLeaveType[]
  policies: PolicyCell[]
  employmentTypes: string[]
}

export interface PolicyEntry {
  employmentType: string
  leaveTypeId: string
  daysPerYear: number | null
}

export function useLeavePolicies() {
  return useQuery({
    queryKey: ["leave-policies"],
    queryFn: async () => (await apiFetch<{ data: LeavePolicyData }>("/api/leave/policies")).data,
  })
}

export function useSaveLeavePolicies() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<unknown, PolicyEntry[]>(qc, {
      mutationFn: (entries) =>
        apiFetch("/api/leave/policies", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries }),
        }),
      invalidate: [["leave-policies"]],
      success: "Leave policy saved",
    }),
  )
}

export function useResyncBalances() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<
      { data: { employees: number; balances: number; year: number } },
      number | undefined
    >(qc, {
      mutationFn: (year) =>
        apiFetch("/api/leave/balances/resync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year }),
        }),
      invalidate: [["leave-balances"]],
      success: (d) => `Re-synced ${d.data.balances} balances for ${d.data.employees} employees`,
    }),
  )
}
