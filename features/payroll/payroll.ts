// Statutory computation (India), simplified:
//   PF 12% of basic up to the ₹15,000 ceiling (both shares); ESI 0.75% of gross when gross ≤ ₹21,000;
//   TDS = new-regime FY2025-26 monthly estimate, trued-up at year-end outside HRMS.

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

/** Off: under the 20-employee threshold PF/ESI don't apply, and TDS is handled outside HRMS. */
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

  // pfEmployer is the company's share, never withheld from the employee.
  const totalDeductions =
    statutory.pfEmployee + statutory.esi + statutory.tds + Math.max(0, otherDeductions)

  return {
    ...statutory,
    grossSalary,
    totalDeductions,
    netSalary: Math.max(0, grossSalary - totalDeductions),
  }
}

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
