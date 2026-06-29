"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttendanceEmployee {
  id: string
  firstName: string
  lastName: string
  employeeNo: string
  profilePhoto: string | null
  department: { id: string; name: string } | null
}

export interface AttendanceLog {
  id: string
  employeeId: string
  deviceId: string | null
  date: string
  checkIn: string | null
  checkOut: string | null
  workHours: number | null
  status: string
  isManual: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
  employee?: AttendanceEmployee
}

export interface AttendanceFilters {
  employeeId?: string
  dateFrom?: string
  dateTo?: string
  status?: string
  page?: number
  limit?: number
}

export interface MyAttendanceFilters {
  days?: number
  status?: string
  page?: number
  limit?: number
}

export interface AttendanceSummary {
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNo: string
  }
  month: number
  year: number
  presentDays: number
  absentDays: number
  lateDays: number
  halfDays: number
  onLeaveDays: number
  holidayDays: number
  weekendDays: number
  totalWorkHours: number
  avgHoursPerDay: number
  totalRecords: number
}

export interface HikvisionDevice {
  id: string
  name: string
  deviceSerial: string
  ipAddress: string
  port: number
  username: string
  password: string
  location: string | null
  isActive: boolean
  lastSyncAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Holiday {
  id: string
  name: string
  date: string
  description: string | null
  isOptional: boolean
  createdAt: string
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

export type CalendarDayStatus =
  | "PRESENT"
  | "HALF_DAY"
  | "ABSENT"
  | "WEEKEND"
  | "HOLIDAY"
  | "LEAVE"
  | "UPCOMING"

export interface CalendarDay {
  date: string
  day: number
  dow: number
  status: CalendarDayStatus
  label: string | null
  checkIn: string | null
  checkOut: string | null
  workHours: number | null
}

export interface AttendanceCalendarMonth {
  year: number
  month: number
  /** ISO date (YYYY-MM-DD) of the employee's first-ever punch, or null. */
  firstPunchDate: string | null
  days: CalendarDay[]
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchAttendanceLogs(
  filters: AttendanceFilters,
): Promise<PaginatedResponse<AttendanceLog>> {
  const params = new URLSearchParams()
  if (filters.employeeId) params.set("employeeId", filters.employeeId)
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
  if (filters.dateTo) params.set("dateTo", filters.dateTo)
  if (filters.status) params.set("status", filters.status)
  if (filters.page) params.set("page", String(filters.page))
  if (filters.limit) params.set("limit", String(filters.limit))

  return apiFetch<PaginatedResponse<AttendanceLog>>(`/api/attendance?${params.toString()}`)
}

async function fetchMyAttendance(
  filters: MyAttendanceFilters,
): Promise<PaginatedResponse<AttendanceLog>> {
  const params = new URLSearchParams()
  if (filters.days) params.set("days", String(filters.days))
  if (filters.status) params.set("status", filters.status)
  if (filters.page) params.set("page", String(filters.page))
  if (filters.limit) params.set("limit", String(filters.limit))

  return apiFetch<PaginatedResponse<AttendanceLog>>(`/api/attendance/me?${params.toString()}`)
}

async function fetchMyCalendar(
  year: number,
  month: number,
): Promise<{ data: AttendanceCalendarMonth }> {
  const mm = String(month).padStart(2, "0")
  return apiFetch<{ data: AttendanceCalendarMonth }>(
    `/api/attendance/me/calendar?month=${year}-${mm}`,
  )
}

async function fetchAttendanceSummary(
  employeeId: string,
  month: number,
  year: number,
): Promise<{ data: AttendanceSummary }> {
  const params = new URLSearchParams({ employeeId, month: String(month), year: String(year) })
  return apiFetch<{ data: AttendanceSummary }>(`/api/attendance/summary?${params.toString()}`)
}

async function createAttendanceLog(
  body: Record<string, unknown>,
): Promise<{ data: AttendanceLog }> {
  return apiFetch<{ data: AttendanceLog }>("/api/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function updateAttendanceLog({
  id,
  body,
}: {
  id: string
  body: Record<string, unknown>
}): Promise<{ data: AttendanceLog }> {
  return apiFetch<{ data: AttendanceLog }>(`/api/attendance/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function deleteAttendanceLog(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/attendance/${id}`, { method: "DELETE" })
}

async function fetchDevices(): Promise<{ data: HikvisionDevice[] }> {
  return apiFetch<{ data: HikvisionDevice[] }>("/api/attendance/devices")
}

async function createDevice(body: Record<string, unknown>): Promise<{ data: HikvisionDevice }> {
  return apiFetch<{ data: HikvisionDevice }>("/api/attendance/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function updateDevice({
  id,
  body,
}: {
  id: string
  body: Record<string, unknown>
}): Promise<{ data: HikvisionDevice }> {
  return apiFetch<{ data: HikvisionDevice }>(`/api/attendance/devices/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function deleteDevice(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/attendance/devices/${id}`, { method: "DELETE" })
}

async function syncDevice(id: string): Promise<{ message: string; synced: number }> {
  return apiFetch<{ message: string; synced: number }>(`/api/attendance/devices/${id}/sync`, {
    method: "POST",
  })
}

async function fetchHolidays(year?: number): Promise<{ data: Holiday[] }> {
  const params = new URLSearchParams()
  if (year) params.set("year", String(year))
  return apiFetch<{ data: Holiday[] }>(`/api/attendance/holidays?${params.toString()}`)
}

async function createHoliday(body: Record<string, unknown>): Promise<{ data: Holiday }> {
  return apiFetch<{ data: Holiday }>("/api/attendance/holidays", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function deleteHoliday(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/attendance/holidays/${id}`, { method: "DELETE" })
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

export function useAttendanceLogs(filters: AttendanceFilters = {}) {
  return useQuery({
    queryKey: ["attendance-logs", filters],
    queryFn: () => fetchAttendanceLogs(filters),
    staleTime: 30_000,
  })
}

export function useMyAttendance(filters: MyAttendanceFilters = {}) {
  return useQuery({
    queryKey: ["my-attendance", filters],
    queryFn: () => fetchMyAttendance(filters),
    staleTime: 30_000,
  })
}

async function syncAllAttendance(): Promise<{ message: string; synced: number }> {
  return apiFetch<{ message: string; synced: number }>("/api/attendance/sync", { method: "POST" })
}

/** Refresh DB from the device (all employees). Shows the WiFi message on failure. */
export function useSyncAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: syncAllAttendance,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["my-attendance"] })
      qc.invalidateQueries({ queryKey: ["my-attendance-calendar"] })
      qc.invalidateQueries({ queryKey: ["attendance-logs"] })
      qc.invalidateQueries({ queryKey: ["attendance-summary"] })
      toast.success(data.message || "Attendance refreshed")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to refresh attendance")
    },
  })
}

export function useMyAttendanceCalendar(year: number, month: number) {
  return useQuery({
    queryKey: ["my-attendance-calendar", year, month],
    queryFn: () => fetchMyCalendar(year, month),
    staleTime: 30_000,
  })
}

export function useAttendanceSummary(
  employeeId: string | null | undefined,
  month: number,
  year: number,
) {
  return useQuery({
    queryKey: ["attendance-summary", employeeId, month, year],
    queryFn: () => fetchAttendanceSummary(employeeId!, month, year),
    enabled: !!employeeId && month >= 1 && month <= 12 && year > 2000,
    staleTime: 60_000,
  })
}

export function useCreateAttendanceLog() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: createAttendanceLog,
      invalidate: [["attendance-logs"], ["attendance-summary"]],
      success: "Attendance record created successfully",
    }),
  )
}

export function useUpdateAttendanceLog() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: updateAttendanceLog,
      invalidate: [["attendance-logs"], ["my-attendance"], ["attendance-summary"]],
      success: "Attendance record updated successfully",
    }),
  )
}

export function useDeleteAttendanceLog() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: deleteAttendanceLog,
      invalidate: [["attendance-logs"], ["attendance-summary"]],
      success: "Attendance record deleted successfully",
    }),
  )
}

export function useDevices() {
  return useQuery({
    queryKey: ["attendance-devices"],
    queryFn: fetchDevices,
    staleTime: 60_000,
  })
}

export function useCreateDevice() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: createDevice,
      invalidate: [["attendance-devices"]],
      success: "Device added successfully",
    }),
  )
}

export function useUpdateDevice() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: updateDevice,
      invalidate: [["attendance-devices"]],
      success: "Device updated successfully",
    }),
  )
}

export function useDeleteDevice() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: deleteDevice,
      invalidate: [["attendance-devices"]],
      success: "Device deleted successfully",
    }),
  )
}

export function useSyncDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: syncDevice,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["attendance-devices"] })
      queryClient.invalidateQueries({ queryKey: ["attendance-logs"] })
      queryClient.invalidateQueries({ queryKey: ["attendance-summary"] })
      toast.success(data.message || `Synced ${data.synced} records`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to sync device")
    },
  })
}

async function testDevice(id: string): Promise<{
  success: boolean
  message: string
  info?: { deviceName: string; model: string; firmwareVersion: string }
}> {
  return apiFetch<{
    success: boolean
    message: string
    info?: { deviceName: string; model: string; firmwareVersion: string }
  }>(`/api/attendance/devices/${id}/test`, { method: "POST" })
}

export function useTestDevice() {
  return useMutation({
    mutationFn: testDevice,
    onSuccess: (data) => {
      if (data.success) {
        const detail = data.info ? ` - ${data.info.deviceName} (${data.info.model})` : ""
        toast.success(`Connection successful${detail}`)
      } else {
        toast.error(data.message || "Connection failed")
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to test device connection")
    },
  })
}

export function useHolidays(year?: number) {
  return useQuery({
    queryKey: ["attendance-holidays", year],
    queryFn: () => fetchHolidays(year),
    staleTime: 300_000,
  })
}

export function useCreateHoliday() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: createHoliday,
      invalidate: [["attendance-holidays"]],
      success: "Holiday added successfully",
    }),
  )
}

export function useDeleteHoliday() {
  const qc = useQueryClient()

  return useMutation(
    mutationWithToast(qc, {
      mutationFn: deleteHoliday,
      invalidate: [["attendance-holidays"]],
      success: "Holiday deleted successfully",
    }),
  )
}
