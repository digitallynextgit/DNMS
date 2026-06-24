"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

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

  const res = await fetch(`/api/attendance?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to fetch attendance logs" }))
    throw new Error(err.error?.message || "Failed to fetch attendance logs")
  }
  return res.json()
}

async function fetchMyAttendance(
  filters: MyAttendanceFilters,
): Promise<PaginatedResponse<AttendanceLog>> {
  const params = new URLSearchParams()
  if (filters.days) params.set("days", String(filters.days))
  if (filters.status) params.set("status", filters.status)
  if (filters.page) params.set("page", String(filters.page))
  if (filters.limit) params.set("limit", String(filters.limit))

  const res = await fetch(`/api/attendance/me?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to fetch attendance" }))
    throw new Error(err.error?.message || "Failed to fetch attendance")
  }
  return res.json()
}

async function fetchAttendanceSummary(
  employeeId: string,
  month: number,
  year: number,
): Promise<{ data: AttendanceSummary }> {
  const params = new URLSearchParams({ employeeId, month: String(month), year: String(year) })
  const res = await fetch(`/api/attendance/summary?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to fetch summary" }))
    throw new Error(err.error?.message || "Failed to fetch summary")
  }
  return res.json()
}

async function createAttendanceLog(
  body: Record<string, unknown>,
): Promise<{ data: AttendanceLog }> {
  const res = await fetch("/api/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create attendance log" }))
    throw new Error(err.error?.message || "Failed to create attendance log")
  }
  return res.json()
}

async function updateAttendanceLog({
  id,
  body,
}: {
  id: string
  body: Record<string, unknown>
}): Promise<{ data: AttendanceLog }> {
  const res = await fetch(`/api/attendance/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to update attendance log" }))
    throw new Error(err.error?.message || "Failed to update attendance log")
  }
  return res.json()
}

async function deleteAttendanceLog(id: string): Promise<{ message: string }> {
  const res = await fetch(`/api/attendance/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to delete attendance log" }))
    throw new Error(err.error?.message || "Failed to delete attendance log")
  }
  return res.json()
}

async function fetchDevices(): Promise<{ data: HikvisionDevice[] }> {
  const res = await fetch("/api/attendance/devices")
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to fetch devices" }))
    throw new Error(err.error?.message || "Failed to fetch devices")
  }
  return res.json()
}

async function createDevice(body: Record<string, unknown>): Promise<{ data: HikvisionDevice }> {
  const res = await fetch("/api/attendance/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create device" }))
    throw new Error(err.error?.message || "Failed to create device")
  }
  return res.json()
}

async function updateDevice({
  id,
  body,
}: {
  id: string
  body: Record<string, unknown>
}): Promise<{ data: HikvisionDevice }> {
  const res = await fetch(`/api/attendance/devices/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to update device" }))
    throw new Error(err.error?.message || "Failed to update device")
  }
  return res.json()
}

async function deleteDevice(id: string): Promise<{ message: string }> {
  const res = await fetch(`/api/attendance/devices/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to delete device" }))
    throw new Error(err.error?.message || "Failed to delete device")
  }
  return res.json()
}

async function syncDevice(id: string): Promise<{ message: string; synced: number }> {
  const res = await fetch(`/api/attendance/devices/${id}/sync`, { method: "POST" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to sync device" }))
    throw new Error(err.error?.message || "Failed to sync device")
  }
  return res.json()
}

async function fetchHolidays(year?: number): Promise<{ data: Holiday[] }> {
  const params = new URLSearchParams()
  if (year) params.set("year", String(year))
  const res = await fetch(`/api/attendance/holidays?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to fetch holidays" }))
    throw new Error(err.error?.message || "Failed to fetch holidays")
  }
  return res.json()
}

async function createHoliday(body: Record<string, unknown>): Promise<{ data: Holiday }> {
  const res = await fetch("/api/attendance/holidays", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create holiday" }))
    throw new Error(err.error?.message || "Failed to create holiday")
  }
  return res.json()
}

async function deleteHoliday(id: string): Promise<{ message: string }> {
  const res = await fetch(`/api/attendance/holidays/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to delete holiday" }))
    throw new Error(err.error?.message || "Failed to delete holiday")
  }
  return res.json()
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
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAttendanceLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-logs"] })
      queryClient.invalidateQueries({ queryKey: ["attendance-summary"] })
      toast.success("Attendance record created successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create attendance record")
    },
  })
}

export function useUpdateAttendanceLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateAttendanceLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-logs"] })
      queryClient.invalidateQueries({ queryKey: ["my-attendance"] })
      queryClient.invalidateQueries({ queryKey: ["attendance-summary"] })
      toast.success("Attendance record updated successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update attendance record")
    },
  })
}

export function useDeleteAttendanceLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteAttendanceLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-logs"] })
      queryClient.invalidateQueries({ queryKey: ["attendance-summary"] })
      toast.success("Attendance record deleted successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete attendance record")
    },
  })
}

export function useDevices() {
  return useQuery({
    queryKey: ["attendance-devices"],
    queryFn: fetchDevices,
    staleTime: 60_000,
  })
}

export function useCreateDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-devices"] })
      toast.success("Device added successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add device")
    },
  })
}

export function useUpdateDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-devices"] })
      toast.success("Device updated successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update device")
    },
  })
}

export function useDeleteDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-devices"] })
      toast.success("Device deleted successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete device")
    },
  })
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
  const res = await fetch(`/api/attendance/devices/${id}/test`, { method: "POST" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to test device" }))
    throw new Error(err.error?.message || "Failed to test device")
  }
  return res.json()
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
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-holidays"] })
      toast.success("Holiday added successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add holiday")
    },
  })
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-holidays"] })
      toast.success("Holiday deleted successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete holiday")
    },
  })
}
