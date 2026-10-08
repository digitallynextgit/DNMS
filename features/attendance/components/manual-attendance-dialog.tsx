"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormDialog } from "@/components/shared/form-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS, TONE } from "@/lib/constants"
import { DateField } from "@/components/shared/date-field"
import { TimeField } from "@/components/shared/time-field"
import {
  useCreateAttendanceLog,
  useUpdateAttendanceLog,
} from "@/features/attendance/hooks/use-attendance"
import type { AttendanceLog } from "@/features/attendance/hooks/use-attendance"
import { EmployeeCombobox } from "@/features/employees/components/employee-combobox"
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

// Existing row for the day, so HR corrects rather than re-enters (null if none).
async function fetchDayLog(employeeId: string, date: string): Promise<AttendanceLog | null> {
  const params = new URLSearchParams({ employeeId, dateFrom: date, dateTo: date, limit: "1" })
  const body = await apiFetch<{ data: AttendanceLog[] }>(`/api/attendance?${params.toString()}`)
  return body.data?.[0] ?? null
}

// Picked date + "HH:MM" read as IST (not the browser timezone) -> UTC ISO string.
function buildDatetime(date: string, time: string): string | null {
  if (!time) return null
  return new Date(`${date}T${time}:00.000+05:30`).toISOString()
}

function minutesBetween(checkIn: string, checkOut: string): number {
  const [ih, im] = checkIn.split(":").map(Number)
  const [oh, om] = checkOut.split(":").map(Number)
  return oh * 60 + om - (ih * 60 + im)
}

// Preview of the status the server will derive, as an ATTENDANCE status code so the pill
// matches the real row. "INVALID" falls through to StatusBadge's fallbackColor.
function previewStatus(
  checkIn: string,
  checkOut: string,
): { status: string; label?: string } | null {
  if (!checkIn && !checkOut) return null
  if (checkIn && checkOut) {
    const mins = minutesBetween(checkIn, checkOut)
    if (mins <= 0) return { status: "INVALID", label: "Check-out is before check-in" }
    const hours = mins / 60
    if (hours >= 4 && hours < 8) return { status: "HALF_DAY" }
    return { status: "PRESENT" }
  }
  return { status: "MISSING_PUNCH" }
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

  // Which (employee, date) was prefilled, so editing the times isn't clobbered on re-render.
  const prefilledKey = useRef("")

  // Re-seeded whenever the dialog opens or closes, or the log changes.
  const [seededFor, setSeededFor] = useState<{ log?: AttendanceLog | null; open: boolean }>({
    open: false,
  })
  if (seededFor.log !== editLog || seededFor.open !== open) {
    setSeededFor({ log: editLog, open })
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
    }
  }

  useEffect(() => {
    if (!editLog) prefilledKey.current = ""
  }, [editLog, open])

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
    try {
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
    } catch {
      // the mutation hook already toasts the error; just keep the form open
    }
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
          <Label required>Employee</Label>
          <EmployeeCombobox
            value={employeeId || undefined}
            onChange={(id) => setEmployeeId(id ?? "")}
            placeholder="Select employee..."
            modal
          />
        </div>
      )}

      <div className="space-y-2">
        <Label required>Date</Label>
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

      {status && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status:</span>
          <StatusBadge
            status={status.status}
            label={status.label}
            colorMap={ATTENDANCE_STATUS_COLORS}
            labelMap={ATTENDANCE_STATUS_LABELS}
            fallbackColor={TONE.red}
          />
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
