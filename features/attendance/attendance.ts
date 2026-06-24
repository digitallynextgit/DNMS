// =============================================================================
// Attendance status computation (Digitally Next Code of Conduct)
//
// Status is derived from HOURS WORKED:
//   - no check-in                       → ABSENT
//   - workHours < halfDayMinHours (4h)  → ABSENT   (full-day absent)
//   - 4h ≤ workHours < fullDayHours (8h)→ HALF_DAY
//   - workHours ≥ fullDayHours (8h)     → PRESENT
//   - checked in but no check-out (hours unknown) → PRESENT (incomplete, not penalised)
//
// NOTE: Late-mark detection (e.g. check-in after 9:45, 3 late marks/month → half
// day) is intentionally NOT applied yet. The LATE branches in the attendance
// sync route are commented out (not deleted) so this can be switched on later.
// =============================================================================

import { $Enums } from "@prisma/client"

export interface AttendanceStatusInput {
  /** Whether the employee checked in at all. */
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
