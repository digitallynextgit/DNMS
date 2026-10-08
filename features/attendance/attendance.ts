// Attendance status from hours worked: no check-in or < halfDayMinHours (4h) = ABSENT,
// < fullDayHours (8h) = HALF_DAY, else PRESENT; no check-out yet = PRESENT (not penalised).
// Late-mark rules are intentionally not applied yet.

import { $Enums } from "@prisma/client"

export interface AttendanceStatusInput {
  checkIn: Date | string | null | undefined
  /** Hours worked (check-out minus check-in). null when it can't be computed. */
  workHours: number | null | undefined
}

export interface AttendanceStatusOptions {
  /** Hours that count as a full present day (policy work hours per day). Default 8. */
  fullDayHours?: number
  /** Minimum hours to count as a half day; below this is treated as absent. Default 4. */
  halfDayMinHours?: number
}

export function computeAttendanceStatus(
  input: AttendanceStatusInput,
  options: AttendanceStatusOptions = {},
): $Enums.AttendanceStatus {
  const fullDayHours = options.fullDayHours ?? 8
  const halfDayMinHours = options.halfDayMinHours ?? 4

  if (!input.checkIn) return $Enums.AttendanceStatus.ABSENT
  if (input.workHours == null) return $Enums.AttendanceStatus.PRESENT
  if (input.workHours < halfDayMinHours) return $Enums.AttendanceStatus.ABSENT
  if (input.workHours < fullDayHours) return $Enums.AttendanceStatus.HALF_DAY
  return $Enums.AttendanceStatus.PRESENT
}
