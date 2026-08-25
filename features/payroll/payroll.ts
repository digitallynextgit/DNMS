// =============================================================================
// Payroll statutory computation (India). Simplified but rule-based - replaces
// the old flat passthrough of structure values.
//   - PF:  12% of basic, capped at the ₹15,000 wage ceiling (both shares).
//   - ESI: 0.75% of gross, only when gross ≤ ₹21,000/month.
//   - TDS: new-regime FY2025-26 monthly estimate (std. deduction ₹75k,
//          §87A rebate up to ₹12L taxable, 4% cess).
// TDS is always an estimate; it's trued-up at year-end outside HRMS.
// =============================================================================

export const PF_WAGE_CEILING = 15000
export const ESI_GROSS_LIMIT = 21000

export interface StatutoryDeductions {
  pfEmployee: number
  pfEmployer: number
  esi: number
  tds: number
}

export function computeStatutoryDeductions(input: {
  basic: number
  gross: number
}): StatutoryDeductions {
  const pfBase = Math.min(Math.max(0, input.basic), PF_WAGE_CEILING)
  const pf = Math.round(pfBase * 0.12)
  const esi =
    input.gross > 0 && input.gross <= ESI_GROSS_LIMIT ? Math.round(input.gross * 0.0075) : 0
  return { pfEmployee: pf, pfEmployer: pf, esi, tds: monthlyTds(input.gross) }
}

// =============================================================================
// The single payslip formula. DUP-01.
//
// This used to exist twice, and the two copies disagreed, so a payslip's total
// CHANGED when someone edited it:
//
//   * the generator (POST /api/payroll/records) summed telephoneAllowance into
//     gross and hard-zeroed PF/ESI/TDS, per the documented "<20 employees, no
//     statutory deductions" policy;
//   * the editor (PATCH /api/payroll/records/[id]) left telephoneAllowance OUT
//     of gross and called computeStatutoryDeductions(), re-introducing the very
//     deductions the generator had zeroed.
//
// So adjusting overtime on a DRAFT silently cut the employee's pay twice over.
// Both paths now call computePayslip() and nothing else.
// =============================================================================

/**
 * Whether statutory deductions apply. The company is under the 20-employee
 * threshold, so PF/ESI are not applicable and salary is fully in-hand; TDS is
 * handled outside HRMS. Flip this to re-enable the (already implemented and
 * tested) computeStatutoryDeductions path - it is deliberately a named constant
 * rather than a magic `= 0`, so the policy is visible and reversible in ONE place.
 */
export const STATUTORY_DEDUCTIONS_ENABLED = false

export interface PayslipEarnings {
  basicSalary: number
  hra: number
  conveyance: number
  medicalAllowance: number
  telephoneAllowance: number
  otherAllowances: number
  overtime: number
}

export interface PayslipTotals extends StatutoryDeductions {
  grossSalary: number
  totalDeductions: number
  netSalary: number
}

/** The authoritative gross → deductions → net calculation for one payslip. */
export function computePayslip(earnings: PayslipEarnings, otherDeductions = 0): PayslipTotals {
  const grossSalary =
    earnings.basicSalary +
    earnings.hra +
    earnings.conveyance +
    earnings.medicalAllowance +
    earnings.telephoneAllowance +
    earnings.otherAllowances +
    earnings.overtime

  const statutory = STATUTORY_DEDUCTIONS_ENABLED
    ? computeStatutoryDeductions({ basic: earnings.basicSalary, gross: grossSalary })
    : { pfEmployee: 0, pfEmployer: 0, esi: 0, tds: 0 }

  // pfEmployer is the COMPANY's contribution - it is not withheld from the
  // employee, so it must never appear in totalDeductions.
  const totalDeductions =
    statutory.pfEmployee + statutory.esi + statutory.tds + Math.max(0, otherDeductions)

  return {
    ...statutory,
    grossSalary,
    totalDeductions,
    netSalary: Math.max(0, grossSalary - totalDeductions),
  }
}

/** Sum of all monthly earning components in a salary structure. */
export function totalMonthlyEarnings(s: {
  basicSalary: number
  hra?: number
  conveyance?: number
  medicalAllowance?: number
  telephoneAllowance?: number
  otherAllowances?: number
}): number {
  return (
    (s.basicSalary || 0) +
    (s.hra || 0) +
    (s.conveyance || 0) +
    (s.medicalAllowance || 0) +
    (s.telephoneAllowance || 0) +
    (s.otherAllowances || 0)
  )
}

function monthlyTds(monthlyGross: number): number {
  const annualTaxable = Math.max(0, monthlyGross * 12 - 75000) // standard deduction
  if (annualTaxable <= 1200000) return 0 // §87A rebate (new regime)

  // FY2025-26 new-regime slabs (upper bound, rate)
  const slabs: Array<[number, number]> = [
    [400000, 0],
    [800000, 0.05],
    [1200000, 0.1],
    [1600000, 0.15],
    [2000000, 0.2],
    [2400000, 0.25],
    [Infinity, 0.3],
  ]
  let tax = 0
  let prev = 0
  for (const [cap, rate] of slabs) {
    if (annualTaxable <= prev) break
    tax += (Math.min(annualTaxable, cap) - prev) * rate
    prev = cap
  }
  return Math.round((tax * 1.04) / 12) // 4% health & education cess, monthly
}
