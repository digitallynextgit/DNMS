"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { ReferralRow, ReferralSummary } from "../types"
import type { SubmitReferralInput } from "../schemas/referral.schema"

const MINE = ["referrals", "mine"] as const
const ALL = ["referrals", "all"] as const

export interface ReferableRole {
  id: string
  title: string
  department: string
}

/**
 * Roles an employee can refer somebody to.
 *
 * Its own endpoint rather than the admin careers tree: that one requires
 * recruitment:read, so it returned nothing for everyone except HR.
 */
export function useReferableRoles(enabled = true) {
  return useQuery({
    queryKey: ["referrals", "roles"],
    queryFn: async () => (await apiFetch<{ data: ReferableRole[] }>("/api/referrals/roles")).data,
    staleTime: 5 * 60_000,
    enabled,
  })
}

export function useMyReferrals() {
  return useQuery({
    queryKey: MINE,
    queryFn: async () =>
      (
        await apiFetch<{
          data: { rows: ReferralRow[]; summary: ReferralSummary; me: { employeeNo: string } }
        }>("/api/referrals")
      ).data,
    staleTime: 60_000,
  })
}

export function useSubmitReferral() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (values: SubmitReferralInput) =>
        apiFetch<{ data: { id: string } }>("/api/referrals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }),
      invalidate: [[...MINE], [...ALL]],
      success: "Referral submitted - HR has been notified",
    }),
  )
}

/** Every referral in the business. HR only; 403s for anyone else. */
export interface AdminReferralRow extends ReferralRow {
  referrer: { id: string; name: string; employeeNo: string } | null
  /** What the candidate typed, even when it matched nobody. */
  claimedEmployeeNo: string | null
}

export function useAllReferrals(enabled = true) {
  return useQuery({
    queryKey: ALL,
    queryFn: async () =>
      (await apiFetch<{ data: AdminReferralRow[] }>("/api/referrals/admin")).data,
    staleTime: 60_000,
    enabled,
  })
}

export function useReferralAction() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (
        vars: { id: string; action: "link-hire" | "mark-paid" } & Record<string, unknown>,
      ) =>
        apiFetch(`/api/referrals/${vars.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vars),
        }),
      invalidate: [[...MINE], [...ALL]],
      success: (_d, vars) =>
        vars.action === "link-hire" ? "Hire linked" : "Reward recorded as paid",
    }),
  )
}
