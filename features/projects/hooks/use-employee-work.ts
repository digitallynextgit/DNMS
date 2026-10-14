"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import type { EmployeeWork } from "../lib/employee-work"

/** What a person owns and owes on projects in `month` ("YYYY-MM"); no employeeId = yourself. */
export function useEmployeeWork(employeeId: string | null, month: string) {
  const qs = new URLSearchParams({ month, ...(employeeId ? { employeeId } : {}) })
  return useQuery({
    queryKey: ["employee-work", employeeId ?? "me", month],
    queryFn: () => apiFetch<{ data: EmployeeWork }>(`/api/projects/work?${qs}`).then((r) => r.data),
    staleTime: 60_000,
  })
}
