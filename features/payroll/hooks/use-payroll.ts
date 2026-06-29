"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmployeeSnippet {
  id: string
  firstName: string
  lastName: string
  employeeNo: string
  department: { id: string; name: string } | null
  designation: { id: string; title: string } | null
}

export interface SalaryStructure {
  id: string
  employeeId: string
  basicSalary: number
  hra: number
  conveyance: number
  medicalAllowance: number
  telephoneAllowance: number
  otherAllowances: number
  pfEmployee: number
  pfEmployer: number
  esi: number
  tds: number
  effectiveFrom: string
  createdAt: string
  updatedAt: string
  employee: EmployeeSnippet
}

export interface PayrollRecord {
  id: string
  employeeId: string
  salaryStructureId: string | null
  month: number
  year: number
  workingDays: number
  presentDays: number
  leaveDays: number
  lopDays: number
  basicSalary: number
  hra: number
  conveyance: number
  medicalAllowance: number
  telephoneAllowance: number
  otherAllowances: number
  overtime: number
  grossSalary: number
  pfEmployee: number
  pfEmployer: number
  esi: number
  tds: number
  otherDeductions: number
  totalDeductions: number
  netSalary: number
  status: "DRAFT" | "PROCESSING" | "APPROVED" | "PAID"
  processedAt: string | null
  approvedById: string | null
  paidAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  employee: EmployeeSnippet
  salaryStructure?: {
    id: string
    basicSalary: number
    hra: number
    conveyance: number
    medicalAllowance: number
    telephoneAllowance: number
    otherAllowances: number
    effectiveFrom: string
  } | null
}

export interface PayrollSummary {
  totalGross: number
  totalNet: number
  totalDeductions: number
  employeeCount: number
  statusBreakdown: {
    DRAFT: number
    PROCESSING: number
    APPROVED: number
    PAID: number
  }
  month?: number
  year?: number
}

export interface PayrollFilters {
  month?: number
  year?: number
  status?: string
  employeeId?: string
  search?: string
  page?: number
  limit?: number
}

export interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchSalaryStructures(): Promise<{ data: SalaryStructure[] }> {
  return apiFetch<{ data: SalaryStructure[] }>("/api/payroll/salary-structures")
}

async function fetchSalaryStructure(id: string): Promise<{ data: SalaryStructure }> {
  return apiFetch<{ data: SalaryStructure }>(`/api/payroll/salary-structures/${id}`)
}

async function createSalaryStructure(
  body: Record<string, unknown>,
): Promise<{ data: SalaryStructure }> {
  return apiFetch<{ data: SalaryStructure }>("/api/payroll/salary-structures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function updateSalaryStructure({
  id,
  body,
}: {
  id: string
  body: Record<string, unknown>
}): Promise<{ data: SalaryStructure }> {
  return apiFetch<{ data: SalaryStructure }>(`/api/payroll/salary-structures/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function deleteSalaryStructure(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/payroll/salary-structures/${id}`, { method: "DELETE" })
}

async function fetchPayrollRecords(
  filters: PayrollFilters,
): Promise<{ data: PayrollRecord[]; pagination?: Pagination }> {
  const params = new URLSearchParams()
  if (filters.month) params.set("month", String(filters.month))
  if (filters.year) params.set("year", String(filters.year))
  if (filters.status) params.set("status", filters.status)
  if (filters.employeeId) params.set("employeeId", filters.employeeId)
  if (filters.search) params.set("search", filters.search)
  if (filters.page) params.set("page", String(filters.page))
  if (filters.limit) params.set("limit", String(filters.limit))

  return apiFetch<{ data: PayrollRecord[]; pagination?: Pagination }>(
    `/api/payroll/records?${params.toString()}`,
  )
}

async function fetchPayrollRecord(id: string): Promise<{ data: PayrollRecord }> {
  return apiFetch<{ data: PayrollRecord }>(`/api/payroll/records/${id}`)
}

async function generatePayroll(body: {
  month: number
  year: number
  employeeIds?: string[]
}): Promise<{ message: string; created: number; skipped: number; errors: number }> {
  return apiFetch<{ message: string; created: number; skipped: number; errors: number }>(
    "/api/payroll/records",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  )
}

async function updatePayrollStatus({
  id,
  status,
  notes,
}: {
  id: string
  status: string
  notes?: string
}): Promise<{ data: PayrollRecord }> {
  return apiFetch<{ data: PayrollRecord }>(`/api/payroll/records/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, notes }),
  })
}

async function deletePayrollRecord(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/payroll/records/${id}`, { method: "DELETE" })
}

async function fetchMyPayslips(): Promise<{ data: PayrollRecord[] }> {
  return apiFetch<{ data: PayrollRecord[] }>("/api/payroll/me")
}

async function fetchMyPayslip(id: string): Promise<{ data: PayrollRecord }> {
  return apiFetch<{ data: PayrollRecord }>(`/api/payroll/me/${id}`)
}

async function fetchPayrollSummary(
  month?: number,
  year?: number,
): Promise<{ data: PayrollSummary }> {
  const params = new URLSearchParams()
  if (month) params.set("month", String(month))
  if (year) params.set("year", String(year))

  return apiFetch<{ data: PayrollSummary }>(`/api/payroll/summary?${params.toString()}`)
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

export function useSalaryStructures() {
  return useQuery({
    queryKey: ["salary-structures"],
    queryFn: fetchSalaryStructures,
    staleTime: 30_000,
  })
}

export function useSalaryStructure(id: string | null | undefined) {
  return useQuery({
    queryKey: ["salary-structure", id],
    queryFn: () => fetchSalaryStructure(id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useCreateSalaryStructure() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: createSalaryStructure,
      invalidate: [["salary-structures"]],
      success: "Salary structure created successfully",
    }),
  )
}

export function useUpdateSalaryStructure() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: updateSalaryStructure,
      invalidate: [["salary-structures"]],
      success: "Salary structure updated successfully",
      onSuccess: (_data, variables) => {
        qc.invalidateQueries({ queryKey: ["salary-structure", variables.id] })
      },
    }),
  )
}

export function useDeleteSalaryStructure() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: deleteSalaryStructure,
      invalidate: [["salary-structures"]],
      success: "Salary structure deleted successfully",
    }),
  )
}

export function usePayrollRecords(filters: PayrollFilters = {}) {
  return useQuery({
    queryKey: ["payroll-records", filters],
    queryFn: () => fetchPayrollRecords(filters),
    staleTime: 15_000,
  })
}

export function usePayrollRecord(id: string | null | undefined) {
  return useQuery({
    queryKey: ["payroll-record", id],
    queryFn: () => fetchPayrollRecord(id!),
    enabled: !!id,
    staleTime: 15_000,
  })
}

export function useGeneratePayroll() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: generatePayroll,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["payroll-records"] })
      queryClient.invalidateQueries({ queryKey: ["payroll-summary"] })
      toast.success(`Payroll generated: ${data.created} records created, ${data.skipped} skipped`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to generate payroll")
    },
  })
}

export function useUpdatePayrollStatus() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: updatePayrollStatus,
      invalidate: [["payroll-records"], ["payroll-summary"]],
      success: "Payroll status updated successfully",
      onSuccess: (_data, variables) => {
        qc.invalidateQueries({ queryKey: ["payroll-record", variables.id] })
      },
    }),
  )
}

export function useDeletePayrollRecord() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: deletePayrollRecord,
      invalidate: [["payroll-records"], ["payroll-summary"]],
      success: "Payroll record deleted successfully",
    }),
  )
}

export function useMyPayslips() {
  return useQuery({
    queryKey: ["my-payslips"],
    queryFn: fetchMyPayslips,
    staleTime: 60_000,
  })
}

export function useMyPayslip(id: string | null | undefined) {
  return useQuery({
    queryKey: ["my-payslip", id],
    queryFn: () => fetchMyPayslip(id!),
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function usePayrollSummary(month?: number, year?: number) {
  return useQuery({
    queryKey: ["payroll-summary", month, year],
    queryFn: () => fetchPayrollSummary(month, year),
    staleTime: 30_000,
  })
}
