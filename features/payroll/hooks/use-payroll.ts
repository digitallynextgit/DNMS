"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

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
  salaryStructure?: { id: string; basicSalary: number; effectiveFrom: string } | null
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
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchSalaryStructures(): Promise<{ data: SalaryStructure[] }> {
  const res = await fetch("/api/payroll/salary-structures")
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to fetch salary structures" }))
    throw new Error(err.error?.message || "Failed to fetch salary structures")
  }
  return res.json()
}

async function fetchSalaryStructure(id: string): Promise<{ data: SalaryStructure }> {
  const res = await fetch(`/api/payroll/salary-structures/${id}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to fetch salary structure" }))
    throw new Error(err.error?.message || "Failed to fetch salary structure")
  }
  return res.json()
}

async function createSalaryStructure(
  body: Record<string, unknown>,
): Promise<{ data: SalaryStructure }> {
  const res = await fetch("/api/payroll/salary-structures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create salary structure" }))
    throw new Error(err.error?.message || "Failed to create salary structure")
  }
  return res.json()
}

async function updateSalaryStructure({
  id,
  body,
}: {
  id: string
  body: Record<string, unknown>
}): Promise<{ data: SalaryStructure }> {
  const res = await fetch(`/api/payroll/salary-structures/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to update salary structure" }))
    throw new Error(err.error?.message || "Failed to update salary structure")
  }
  return res.json()
}

async function deleteSalaryStructure(id: string): Promise<{ message: string }> {
  const res = await fetch(`/api/payroll/salary-structures/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to delete salary structure" }))
    throw new Error(err.error?.message || "Failed to delete salary structure")
  }
  return res.json()
}

async function fetchPayrollRecords(filters: PayrollFilters): Promise<{ data: PayrollRecord[] }> {
  const params = new URLSearchParams()
  if (filters.month) params.set("month", String(filters.month))
  if (filters.year) params.set("year", String(filters.year))
  if (filters.status) params.set("status", filters.status)
  if (filters.employeeId) params.set("employeeId", filters.employeeId)

  const res = await fetch(`/api/payroll/records?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to fetch payroll records" }))
    throw new Error(err.error?.message || "Failed to fetch payroll records")
  }
  return res.json()
}

async function fetchPayrollRecord(id: string): Promise<{ data: PayrollRecord }> {
  const res = await fetch(`/api/payroll/records/${id}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to fetch payroll record" }))
    throw new Error(err.error?.message || "Failed to fetch payroll record")
  }
  return res.json()
}

async function generatePayroll(body: {
  month: number
  year: number
  employeeIds?: string[]
}): Promise<{ message: string; created: number; skipped: number; errors: number }> {
  const res = await fetch("/api/payroll/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to generate payroll" }))
    throw new Error(err.error?.message || "Failed to generate payroll")
  }
  return res.json()
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
  const res = await fetch(`/api/payroll/records/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, notes }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to update payroll status" }))
    throw new Error(err.error?.message || "Failed to update payroll status")
  }
  return res.json()
}

async function deletePayrollRecord(id: string): Promise<{ message: string }> {
  const res = await fetch(`/api/payroll/records/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to delete payroll record" }))
    throw new Error(err.error?.message || "Failed to delete payroll record")
  }
  return res.json()
}

async function fetchMyPayslips(): Promise<{ data: PayrollRecord[] }> {
  const res = await fetch("/api/payroll/me")
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to fetch payslips" }))
    throw new Error(err.error?.message || "Failed to fetch payslips")
  }
  return res.json()
}

async function fetchMyPayslip(id: string): Promise<{ data: PayrollRecord }> {
  const res = await fetch(`/api/payroll/me/${id}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to fetch payslip" }))
    throw new Error(err.error?.message || "Failed to fetch payslip")
  }
  return res.json()
}

async function fetchPayrollSummary(
  month?: number,
  year?: number,
): Promise<{ data: PayrollSummary }> {
  const params = new URLSearchParams()
  if (month) params.set("month", String(month))
  if (year) params.set("year", String(year))

  const res = await fetch(`/api/payroll/summary?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to fetch payroll summary" }))
    throw new Error(err.error?.message || "Failed to fetch payroll summary")
  }
  return res.json()
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
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createSalaryStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-structures"] })
      toast.success("Salary structure created successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create salary structure")
    },
  })
}

export function useUpdateSalaryStructure() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateSalaryStructure,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["salary-structures"] })
      queryClient.invalidateQueries({ queryKey: ["salary-structure", variables.id] })
      toast.success("Salary structure updated successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update salary structure")
    },
  })
}

export function useDeleteSalaryStructure() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteSalaryStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-structures"] })
      toast.success("Salary structure deleted successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete salary structure")
    },
  })
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
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updatePayrollStatus,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payroll-records"] })
      queryClient.invalidateQueries({ queryKey: ["payroll-record", variables.id] })
      queryClient.invalidateQueries({ queryKey: ["payroll-summary"] })
      toast.success("Payroll status updated successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update payroll status")
    },
  })
}

export function useDeletePayrollRecord() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deletePayrollRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-records"] })
      queryClient.invalidateQueries({ queryKey: ["payroll-summary"] })
      toast.success("Payroll record deleted successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete payroll record")
    },
  })
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
