// =============================================================================
// Probation rules (Digitally Next)
//
// An employee is on probation until `probationMonths` after their joining date.
// Admin controls two fields (see Employee model):
//   - onProbation     (toggle)  : ON = apply the date rule, OFF = confirmed early
//   - probationMonths (3 | 6)   : length of the probation window
//
// Effective status = onProbation AND today < (dateOfJoining + probationMonths).
//
// During probation an employee LOSES (per BFG/DN policy):
//   - Leave: all leave types are blocked (no CL/SL/EL/PL/ML/Short).
//   - WFH:   Tier 1 - blocked except emergencies needing Manager + HR approval.
// Earned Leave additionally unlocks only 6 months AFTER probation ends.
//
// Pure functions - safe to import in both server and client components.
// =============================================================================

// 0 = confirmed immediately (no probation window: end date == joining date).
export const PROBATION_MONTHS_OPTIONS = [0, 1, 2, 3, 4, 5, 6] as const
export type ProbationMonths = (typeof PROBATION_MONTHS_OPTIONS)[number]
export const DEFAULT_PROBATION_MONTHS: ProbationMonths = 6

export interface ProbationInput {
  onProbation?: boolean | null
  probationMonths?: number | null
  dateOfJoining?: Date | string | null
}

/** The date probation ends: dateOfJoining + probationMonths. Null if no joining date. */
export function getProbationEndDate(emp: ProbationInput): Date | null {
  if (!emp.dateOfJoining) return null
  const months = emp.probationMonths ?? DEFAULT_PROBATION_MONTHS
  const end = new Date(emp.dateOfJoining)
  end.setMonth(end.getMonth() + months)
  return end
}

/** Whether the employee is currently on probation. */
export function isOnProbation(emp: ProbationInput, now: Date = new Date()): boolean {
  if (!emp.onProbation) return false // admin toggled off → confirmed
  const end = getProbationEndDate(emp)
  if (!end) return true // toggle on but no joining date → treat as on probation (restrictive)
  return now < end
}

export interface ProbationStatus {
  onProbation: boolean
  endDate: Date | null
  daysRemaining: number
}

/** Convenience bundle for UI: status, end date, and days remaining. */
export function getProbationStatus(emp: ProbationInput, now: Date = new Date()): ProbationStatus {
  const endDate = getProbationEndDate(emp)
  const onProbation = isOnProbation(emp, now)
  const daysRemaining =
    onProbation && endDate
      ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000))
      : 0
  return { onProbation, endDate, daysRemaining }
}
