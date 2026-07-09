"use client"

import { useCallback, useEffect, useState } from "react"
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

export function useLeavePolicies(enabled = true) {
  return useQuery({
    queryKey: ["leave-policies"],
    // The route returns the standard envelope wrapping a `serialize({ data })`
    // payload, so the matrix sits two `data` levels deep ({ data: { data: … } }).
    queryFn: async () =>
      (await apiFetch<{ data: { data: LeavePolicyData } }>("/api/leave/policies")).data.data,
    enabled,
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
      success: (d) => `Synced ${d.data.balances} balances for ${d.data.employees} employees`,
    }),
  )
}

// ─── Policy editor ─────────────────────────────────────────────────────────────
// Holds the grid's editing state so the Save / Re-sync toolbar can be rendered
// anywhere (e.g. next to the tabs in the page header) while the matrix table
// renders the inputs - both share this single editor instance.
export const policyCellKey = (employmentType: string, leaveTypeId: string) =>
  `${employmentType}__${leaveTypeId}`

export interface LeavePolicyEditor {
  isLoading: boolean
  data: LeavePolicyData | undefined
  values: Record<string, string>
  dirty: boolean
  setCell: (employmentType: string, leaveTypeId: string, v: string) => void
  handleSave: () => void
  saving: boolean
  resyncPending: boolean
  resyncOpen: boolean
  setResyncOpen: (open: boolean) => void
  confirmResync: () => void
}

export function useLeavePolicyEditor(enabled = true): LeavePolicyEditor {
  const { data, isLoading } = useLeavePolicies(enabled)
  const save = useSaveLeavePolicies()
  const resync = useResyncBalances()

  const [values, setValues] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [resyncOpen, setResyncOpen] = useState(false)

  // Seed the grid from saved policies (until the user starts editing).
  useEffect(() => {
    if (!data || dirty) return
    const next: Record<string, string> = {}
    for (const p of data.policies)
      next[policyCellKey(p.employmentType, p.leaveTypeId)] = String(p.daysPerYear)
    setValues(next)
  }, [data, dirty])

  const setCell = useCallback((employmentType: string, leaveTypeId: string, v: string) => {
    setDirty(true)
    setValues((prev) => ({ ...prev, [policyCellKey(employmentType, leaveTypeId)]: v }))
  }, [])

  const handleSave = useCallback(() => {
    if (!data) return
    const entries: PolicyEntry[] = data.employmentTypes.flatMap((et) =>
      data.types.map((t) => {
        const raw = values[policyCellKey(et, t.id)]
        const daysPerYear = raw === undefined || raw === "" ? null : Number(raw)
        return { employmentType: et, leaveTypeId: t.id, daysPerYear }
      }),
    )
    save.mutate(entries, { onSuccess: () => setDirty(false) })
  }, [data, values, save])

  const confirmResync = useCallback(() => {
    resync.mutate(undefined, { onSuccess: () => setResyncOpen(false) })
  }, [resync])

  return {
    isLoading,
    data,
    values,
    dirty,
    setCell,
    handleSave,
    saving: save.isPending,
    resyncPending: resync.isPending,
    resyncOpen,
    setResyncOpen,
    confirmResync,
  }
}
