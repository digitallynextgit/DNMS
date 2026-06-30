"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormDialog } from "@/components/shared/form-dialog"
import { DateField } from "@/components/shared/date-field"
import { TimeField } from "@/components/shared/time-field"
import {
  useCreateAttendanceLog,
  useUpdateAttendanceLog,
} from "@/features/attendance/hooks/use-attendance"
import type { AttendanceLog } from "@/features/attendance/hooks/use-attendance"
import { EmployeeCombobox } from "@/features/employees"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface ManualAttendanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editLog?: AttendanceLog | null
}

// HH:MM of a stored UTC datetime, shown in IST (the office/device timezone).
function toLocalTime(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  })
}

// Existing attendance row for an employee on a given day (so HR corrects rather
// than re-enters). Returns null when there's no record yet.
async function fetchDayLog(employeeId: string, date: string): Promise<AttendanceLog | null> {
  const params = new URLSearchParams({ employeeId, dateFrom: date, dateTo: date, limit: "1" })
  const body = await apiFetch<{ data: AttendanceLog[] }>(`/api/attendance?${params.toString()}`)
  return body.data?.[0] ?? null
}

// Combine the picked date + "HH:MM" IST time into a UTC ISO string. The entered
// time is interpreted as IST (the office timezone), not the browser's.
function buildDatetime(date: string, time: string): string | null {
  if (!time) return null
  return new Date(`${date}T${time}:00.000+05:30`).toISOString()
}

function minutesBetween(checkIn: string, checkOut: string): number {
  const [ih, im] = checkIn.split(":").map(Number)
  const [oh, om] = checkOut.split(":").map(Number)
  return oh * 60 + om - (ih * 60 + im)
}

// Live preview of the status the server will derive from the punches.
function previewStatus(checkIn: string, checkOut: string): { label: string; cls: string } | null {
  const green = "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300"
  const orange = "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
  const purple = "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
  const red = "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"

  if (!checkIn && !checkOut) return null
  if (checkIn && checkOut) {
    const mins = minutesBetween(checkIn, checkOut)
    if (mins <= 0) return { label: "Check-out is before check-in", cls: red }
    const hours = mins / 60
    if (hours >= 4 && hours < 8) return { label: "Half day", cls: orange }
    return { label: "Present", cls: green }
  }
  return { label: "Missing punch", cls: purple }
}

function workHoursPreview(checkIn: string, checkOut: string): string {
  if (!checkIn || !checkOut) return ""
  const mins = minutesBetween(checkIn, checkOut)
  if (mins <= 0) return ""
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h${m > 0 ? ` ${m}m` : ""}`
}

export function ManualAttendanceDialog({
  open,
  onOpenChange,
  editLog,
}: ManualAttendanceDialogProps) {
  const isEdit = !!editLog

  const [employeeId, setEmployeeId] = useState("")
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [notes, setNotes] = useState("")

  const createLog = useCreateAttendanceLog()
  const updateLog = useUpdateAttendanceLog()
  const isPending = createLog.isPending || updateLog.isPending

  // Tracks which (employee, date) we've already prefilled, so editing the times
  // doesn't get clobbered on re-render.
  const prefilledKey = useRef("")

  useEffect(() => {
    if (editLog) {
      setEmployeeId(editLog.employeeId)
      setDate(format(new Date(editLog.date), "yyyy-MM-dd"))
      setCheckIn(toLocalTime(editLog.checkIn))
      setCheckOut(toLocalTime(editLog.checkOut))
      setNotes(editLog.notes ?? "")
    } else {
      setEmployeeId("")
      setDate(format(new Date(), "yyyy-MM-dd"))
      setCheckIn("")
      setCheckOut("")
      setNotes("")
      prefilledKey.current = ""
    }
  }, [editLog, open])

  // When HR picks an employee + date, pull any existing punches for that day and
  // prefill them (so they correct what's there instead of starting blank).
  const { data: dayLog } = useQuery({
    queryKey: ["attendance-day", employeeId, date],
    queryFn: () => fetchDayLog(employeeId, date),
    enabled: open && !isEdit && !!employeeId && !!date,
    staleTime: 0,
  })

  useEffect(() => {
    if (isEdit || !open || !employeeId || !date || dayLog === undefined) return
    const key = `${employeeId}|${date}`
    if (prefilledKey.current === key) return
    prefilledKey.current = key
    setCheckIn(toLocalTime(dayLog?.checkIn ?? null))
    setCheckOut(toLocalTime(dayLog?.checkOut ?? null))
    setNotes(dayLog?.notes ?? "")
  }, [dayLog, employeeId, date, isEdit, open])

  const status = previewStatus(checkIn, checkOut)
  const hours = workHoursPreview(checkIn, checkOut)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // No explicit status - the server derives it from the punch times.
    const payload: Record<string, unknown> = {
      employeeId,
      date,
      notes: notes || null,
      checkIn: buildDatetime(date, checkIn),
      checkOut: buildDatetime(date, checkOut),
    }

    if (isEdit && editLog) {
      await updateLog.mutateAsync({ id: editLog.id, body: payload })
    } else {
      await createLog.mutateAsync(payload)
    }
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Correct Punch"
      isEdit={isEdit}
      isPending={isPending}
      submitDisabled={(!isEdit && !employeeId) || !date || (!checkIn && !checkOut)}
      submitLabel={isEdit ? "Save Changes" : "Apply"}
      onSubmit={handleSubmit}
      contentClassName="sm:max-w-[480px]"
    >
      {!isEdit && (
        <div className="space-y-2">
          <Label>Employee</Label>
          <EmployeeCombobox
            value={employeeId || undefined}
            onChange={(id) => setEmployeeId(id ?? "")}
            placeholder="Select employee..."
            modal
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Date</Label>
        <DateField value={date} onChange={setDate} endMonth={new Date()} modal />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Check In</Label>
          <TimeField value={checkIn} onChange={setCheckIn} modal />
        </div>
        <div className="space-y-2">
          <Label>Check Out</Label>
          <TimeField value={checkOut} onChange={setCheckOut} modal />
        </div>
      </div>

      {/* Auto-derived status + hours preview. */}
      {status && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status:</span>
          <span
            className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", status.cls)}
          >
            {status.label}
          </span>
          {hours && <span className="text-muted-foreground">· {hours}</span>}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Optional notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
    </FormDialog>
  )
}
