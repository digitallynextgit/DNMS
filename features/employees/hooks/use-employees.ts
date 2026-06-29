"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useDebounce } from "@/hooks/use-debounce"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"

export interface EmployeeCodeItem {
  id: string
  firstName: string
  lastName: string
  employeeNo: string
  profilePhoto: string | null
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmployeeListItem {
  id: string
  employeeNo: string
  deviceId: string | null
  firstName: string
  lastName: string
  email: string
  phone: string | null
  personalEmail: string | null
  personalPhone: string | null
  dateOfBirth: string | null
  gender: string | null
  nationality: string | null
  bloodGroup: string | null
  profilePhoto: string | null
  status: string
  employmentType: string
  dateOfJoining: string | null
  probationEndDate: string | null
  onProbation: boolean
  probationMonths: number
  workLocation: string | null
  isActive: boolean
  createdAt: string
  department: { id: string; name: string } | null
  designation: { id: string; title: string } | null
  jobRole: { id: string; name: string } | null
  manager: { id: string; firstName: string; lastName: string } | null
}

export interface EmployeeDetail extends EmployeeListItem {
  currentAddress: Record<string, string> | null
  permanentAddress: Record<string, string> | null
  emergencyContact: Record<string, string> | null
  hasGmailAppPassword?: boolean
  _count: { subordinates: number; documents: number }
  employeeRoles: Array<{
    id: string
    role: { id: string; name: string; displayName: string }
  }>
  department: { id: string; name: string; code: string } | null
  designation: { id: string; title: string; level: number } | null
  manager: {
    id: string
    firstName: string
    lastName: string
    email: string
    profilePhoto: string | null
  } | null
}

export interface Department {
  id: string
  name: string
  code: string
  description: string | null
  headId: string | null
}

export interface Designation {
  id: string
  title: string
  level: number
}

export interface EmployeeFilters {
  search?: string
  departmentId?: string
  designationId?: string
  status?: string
  employmentType?: string
  page?: number
  limit?: number
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchEmployees(
  filters: EmployeeFilters,
): Promise<PaginatedResponse<EmployeeListItem>> {
  const qs = new URLSearchParams()
  if (filters.search) qs.set("search", filters.search)
  if (filters.departmentId) qs.set("departmentId", filters.departmentId)
  if (filters.designationId) qs.set("designationId", filters.designationId)
  if (filters.status) qs.set("status", filters.status)
  if (filters.employmentType) qs.set("employmentType", filters.employmentType)
  if (filters.page !== undefined) qs.set("page", String(filters.page))
  if (filters.limit !== undefined) qs.set("limit", String(filters.limit))
  const query = qs.toString()
  return (
    await apiFetch<{ data: PaginatedResponse<EmployeeListItem> }>(
      `/api/employees${query ? `?${query}` : ""}`,
    )
  ).data as PaginatedResponse<EmployeeListItem>
}

async function fetchEmployee(id: string): Promise<{ data: EmployeeDetail }> {
  return (await apiFetch<{ data: { data: EmployeeDetail } }>(`/api/employees/${id}`)).data as {
    data: EmployeeDetail
  }
}

async function createEmployee(body: Record<string, unknown>): Promise<{ data: EmployeeListItem }> {
  return (
    await apiFetch<{ data: { data: EmployeeListItem } }>("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).data as { data: EmployeeListItem }
}

async function updateEmployee({
  id,
  body,
}: {
  id: string
  body: Record<string, unknown>
}): Promise<{ data: EmployeeListItem }> {
  return (
    await apiFetch<{ data: { data: EmployeeListItem } }>(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).data as { data: EmployeeListItem }
}

async function deleteEmployee(id: string): Promise<{ message: string }> {
  return (
    await apiFetch<{ data: { message: string } }>(`/api/employees/${id}/deactivate`, {
      method: "POST",
    })
  ).data
}

async function activateEmployee(id: string): Promise<{ message: string }> {
  await apiFetch<{ data: unknown }>(`/api/employees/${id}/activate`, { method: "POST" })
  return { message: "Employee reactivated" }
}

async function hardDeleteEmployee(id: string): Promise<{ message: string }> {
  return (
    await apiFetch<{ data: { message: string } }>(`/api/employees/${id}`, { method: "DELETE" })
  ).data
}

async function fetchOrgChart(): Promise<{ data: import("@/types").OrgNode[] }> {
  return (
    await apiFetch<{ data: { data: import("@/types").OrgNode[] } }>("/api/employees/org-chart")
  ).data
}

async function fetchDepartments(): Promise<{ data: Department[] }> {
  return { data: (await apiFetch<{ data: Department[] }>("/api/departments")).data }
}

async function fetchDesignations(): Promise<{ data: Designation[] }> {
  return { data: (await apiFetch<{ data: Designation[] }>("/api/designations")).data }
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

export function useEmployees(filters: EmployeeFilters = {}) {
  return useQuery({
    queryKey: ["employees", filters],
    queryFn: () => fetchEmployees(filters),
    staleTime: 30_000,
  })
}

export function useEmployee(id: string | null | undefined) {
  return useQuery({
    queryKey: ["employee", id],
    queryFn: () => fetchEmployee(id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useEmployeeCodes() {
  return useQuery({
    queryKey: ["employee-codes"],
    queryFn: async () =>
      (await apiFetch<{ data: { data: EmployeeCodeItem[] } }>("/api/employees/codes")).data as {
        data: EmployeeCodeItem[]
      },
    staleTime: 60_000,
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: createEmployee,
      invalidate: [["employees"]],
      success: "Employee created successfully",
      onError: (error) => {
        toast.error(error.message || "Failed to create employee")
      },
    }),
  )
}

export function useUpdateEmployee() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: updateEmployee,
      invalidate: [["employees"]],
      success: "Employee updated successfully",
      onSuccess: (_data, variables) => {
        qc.invalidateQueries({ queryKey: ["employee", variables.id] })
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update employee")
      },
    }),
  )
}

export function useDeleteEmployee() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: deleteEmployee,
      invalidate: [["employees"]],
      success: "Employee deactivated",
      onError: (error) => {
        toast.error(error.message || "Failed to deactivate employee")
      },
    }),
  )
}

export function useActivateEmployee() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: activateEmployee,
      invalidate: [["employees"]],
      success: "Employee reactivated",
      onError: (error) => {
        toast.error(error.message || "Failed to reactivate employee")
      },
    }),
  )
}

export function useHardDeleteEmployee() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: hardDeleteEmployee,
      invalidate: [["employees"]],
      success: "Employee deleted permanently",
      onError: (error) => {
        toast.error(error.message || "Failed to delete employee")
      },
    }),
  )
}

export function useOrgChart() {
  return useQuery({
    queryKey: ["org-chart"],
    queryFn: fetchOrgChart,
    staleTime: 60_000,
  })
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
    staleTime: 300_000,
  })
}

export function useDesignations() {
  return useQuery({
    queryKey: ["designations"],
    queryFn: fetchDesignations,
    staleTime: 300_000,
  })
}

export type EmailAvailability = "idle" | "invalid" | "checking" | "available" | "taken"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Debounced, real-time check that an email isn't already used (as a work OR
 * personal email) by another employee. `excludeId` skips the employee being
 * edited so their own current address reads as available.
 */
export function useEmailAvailability(
  rawValue: string | undefined,
  excludeId?: string,
): EmailAvailability {
  const value = (rawValue ?? "").trim()
  const debounced = useDebounce(value, 500)
  const [status, setStatus] = useState<EmailAvailability>("idle")

  useEffect(() => {
    if (!debounced) {
      setStatus("idle")
      return
    }
    if (!EMAIL_RE.test(debounced)) {
      setStatus("invalid")
      return
    }
    let active = true
    setStatus("checking")
    const qs = new URLSearchParams({ email: debounced })
    if (excludeId) qs.set("excludeId", excludeId)
    apiFetch<{ data: { available: boolean } }>(`/api/employees/check-email?${qs.toString()}`)
      .then((body) => {
        if (!active) return
        setStatus(body.data.available ? "available" : "taken")
      })
      .catch(() => active && setStatus("idle"))
    return () => {
      active = false
    }
  }, [debounced, excludeId])

  return status
}
