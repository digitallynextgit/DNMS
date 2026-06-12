"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useDebounce } from "@/hooks/use-debounce"
import { getDepartments } from "@/lib/actions/departments"
import { getDesignations } from "@/lib/actions/designations"
import {
  getEmployees,
  getEmployee,
  getEmployeeCodes,
  createEmployee as createEmployeeAction,
  updateEmployee as updateEmployeeAction,
  deactivateEmployee,
  deleteEmployeePermanent,
  activateEmployee as activateEmployeeAction,
  checkEmailAvailability,
  getOrgChart,
} from "@/lib/actions/employees"

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
  const r = await getEmployees(filters)
  if (!r.ok) throw new Error(r.error)
  return r.data as PaginatedResponse<EmployeeListItem>
}

async function fetchEmployee(id: string): Promise<{ data: EmployeeDetail }> {
  const r = await getEmployee(id)
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: EmployeeDetail }
}

async function createEmployee(body: Record<string, unknown>): Promise<{ data: EmployeeListItem }> {
  const r = await createEmployeeAction(body)
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: EmployeeListItem }
}

async function updateEmployee({
  id,
  body,
}: {
  id: string
  body: Record<string, unknown>
}): Promise<{ data: EmployeeListItem }> {
  const r = await updateEmployeeAction(id, body)
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: EmployeeListItem }
}

async function deleteEmployee(id: string): Promise<{ message: string }> {
  const r = await deactivateEmployee(id)
  if (!r.ok) throw new Error(r.error)
  return r.data
}

async function activateEmployee(id: string): Promise<{ message: string }> {
  const r = await activateEmployeeAction(id)
  if (!r.ok) throw new Error(r.error)
  return { message: "Employee reactivated" }
}

async function hardDeleteEmployee(id: string): Promise<{ message: string }> {
  const r = await deleteEmployeePermanent(id)
  if (!r.ok) throw new Error(r.error)
  return r.data
}

async function fetchOrgChart(): Promise<{ data: import("@/types").OrgNode[] }> {
  const r = await getOrgChart()
  if (!r.ok) throw new Error(r.error)
  return r.data
}

async function fetchDepartments(): Promise<{ data: Department[] }> {
  const r = await getDepartments()
  if (!r.ok) throw new Error(r.error)
  return { data: r.data }
}

async function fetchDesignations(): Promise<{ data: Designation[] }> {
  const r = await getDesignations()
  if (!r.ok) throw new Error(r.error)
  return { data: r.data }
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
    queryFn: async () => {
      const r = await getEmployeeCodes()
      if (!r.ok) throw new Error(r.error)
      return r.data as { data: EmployeeCodeItem[] }
    },
    staleTime: 60_000,
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Employee created successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create employee")
    },
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateEmployee,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      queryClient.invalidateQueries({ queryKey: ["employee", variables.id] })
      toast.success("Employee updated successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update employee")
    },
  })
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Employee deactivated")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to deactivate employee")
    },
  })
}

export function useActivateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: activateEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Employee reactivated")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reactivate employee")
    },
  })
}

export function useHardDeleteEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: hardDeleteEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Employee deleted permanently")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete employee")
    },
  })
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
    checkEmailAvailability(debounced, excludeId)
      .then((r) => {
        if (!active) return
        if (!r.ok) {
          setStatus("idle")
          return
        }
        setStatus(r.data.available ? "available" : "taken")
      })
      .catch(() => active && setStatus("idle"))
    return () => {
      active = false
    }
  }, [debounced, excludeId])

  return status
}
