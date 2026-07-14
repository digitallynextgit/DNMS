"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { MONTHS } from "@/lib/constants"
import { totalMonthlyEarnings } from "@/features/payroll/payroll"
import type { PayrollRecord } from "@/features/payroll/hooks/use-payroll"

// =============================================================================
// Printable salary slip - reproduces docs/salary slip format.pdf (BFG Market
// Consult Pvt Limited). Wrapped in #print-area so the global @media print rule
// (app/globals.css) drops all app chrome and prints just this on white A4.
// =============================================================================

// Company letterhead (from the PDF).
const COMPANY = {
  name: "BFG Market Consult Pvt Limited",
  addressLines: ["18, Block SU, First Floor", "Pitam Pura", "New Delhi- 110034"],
  location: "Delhi",
  paymentMode: "Bank Transfer",
}

const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
]
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function twoDigits(n: number): string {
  if (n < 20) return ones[n]
  return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "")
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  let s = ""
  if (h) s += ones[h] + " Hundred"
  if (rest) s += (h ? " and " : "") + twoDigits(rest)
  return s
}

/** Indian-system number to words, e.g. 80167 → "Eighty thousand one hundred and sixty seven". */
function numberToWords(value: number): string {
  let num = Math.round(value)
  if (num <= 0) return "Zero"
  const crore = Math.floor(num / 10000000)
  num %= 10000000
  const lakh = Math.floor(num / 100000)
  num %= 100000
  const thousand = Math.floor(num / 1000)
  num %= 1000
  const parts: string[] = []
  if (crore) parts.push(numberToWords(crore) + " Crore")
  if (lakh) parts.push(twoDigits(lakh) + " Lakh")
  if (thousand) parts.push(twoDigits(thousand) + " Thousand")
  if (num) parts.push(threeDigits(num))
  const words = parts.join(" ").trim()
  // Sentence case to match the PDF ("Eighty thousand one hundred and sixty seven only").
  return words.charAt(0) + words.slice(1).toLowerCase()
}

/** Mon-Fri count in a calendar month (1-based month). */
function businessDaysInMonth(year: number, month: number): number {
  const days = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

function inr(amount: number): string {
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function inr2(amount: number): string {
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date()
  const dd = String(d.getDate()).padStart(2, "0")
  const mon = d.toLocaleString("en-GB", { month: "short" })
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}-${mon}-${yy}`
}

/**
 * Placeholder shaped like the real salary slip above - same bordered A4 sheet,
 * letterhead + title, the employee detail grid, the earnings table and the
 * net-pay strip. Lets the payslip pages paint their shell (back link, title,
 * actions) immediately instead of blanking the whole screen while loading.
 */
export function PayslipSkeleton() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="space-y-4 rounded border border-neutral-300 px-6 py-5 dark:border-neutral-700">
        {/* Letterhead */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-16 w-16" />
        </div>

        {/* "Salary Slip - Month Year" */}
        <div className="flex justify-center border-t pt-3">
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Employee detail grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </div>

        {/* Earnings / deductions table */}
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-full" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex gap-1.5">
              <Skeleton className="h-6 flex-1" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>

        {/* Net pay + amount in words */}
        <div className="space-y-2 border-t pt-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3.5 w-72" />
        </div>
      </div>
    </div>
  )
}

export function PayslipDocument({ record }: { record: PayrollRecord }) {
  const monthName = MONTHS[record.month - 1]
  const yy = String(record.year).slice(-2)

  // Annual = full (un-prorated) monthly gross × 12, from the salary structure;
  // falls back to this month's gross when the structure is missing.
  const fullMonthly = record.salaryStructure
    ? totalMonthlyEarnings(record.salaryStructure)
    : record.grossSalary
  const annual = Math.round(fullMonthly) * 12

  const breakup = [
    { label: "Basic", amount: record.basicSalary },
    { label: "HRA", amount: record.hra },
    { label: "Transport Allowance", amount: record.conveyance },
    { label: "Medical Allowance", amount: record.medicalAllowance },
    { label: "Telephone/Mobile Bill", amount: record.telephoneAllowance },
    { label: "Special Allowance", amount: record.otherAllowances },
  ]

  const daysInMonth = new Date(record.year, record.month, 0).getDate()
  const workingDays = businessDaysInMonth(record.year, record.month)
  const daysAttended = Math.max(0, workingDays - record.lopDays)
  const total = record.netSalary
  const employeeCode = `BFG/Digitally Next/${record.year}/${record.employee.employeeNo}`

  // Shared cell styles - thin grey borders like the spreadsheet export.
  const b = "border border-neutral-500"
  const cell = `${b} px-2 py-1 align-middle`
  const labelCell = `${cell} font-semibold`

  return (
    <div
      id="print-area"
      className="mx-auto max-w-3xl bg-white text-[12.5px] leading-tight text-black"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <div className={`${b} px-6 py-5`}>
        {/* Letterhead: company (left) + logo (right, if public/bfg-logo.png exists). */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[15px] font-bold">{COMPANY.name}</h1>
            {COMPANY.addressLines.map((line) => (
              <p key={line} className="leading-snug">
                {line}
              </p>
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bfg-logo.png"
            alt=""
            className="h-16 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
        </div>

        <div className="mt-4 border-t border-neutral-500 pt-2 text-center text-[15px] font-semibold">
          Salary Slip – {monthName} {record.year}
        </div>

        {/* Info grid (label / value / label / value). */}
        <table className="mt-3 w-full border-collapse">
          <tbody>
            <tr>
              <td className={labelCell} style={{ width: "15%" }}>
                Name
              </td>
              <td className={cell} style={{ width: "33%" }}>
                {record.employee.firstName} {record.employee.lastName}
              </td>
              <td className={labelCell} style={{ width: "20%" }}>
                Month
              </td>
              <td className={`${cell} text-right`} style={{ width: "32%" }}>
                {monthName}-{yy}
              </td>
            </tr>
            <tr>
              <td className={labelCell}>Payment Mode</td>
              <td className={cell}>{COMPANY.paymentMode}</td>
              <td className={labelCell}>Annual</td>
              <td className={`${cell} text-right tabular-nums`}>{inr(annual)}</td>
            </tr>
            <tr>
              <td className={labelCell}>Location</td>
              <td className={cell}>{COMPANY.location}</td>
              <td className={labelCell}>Employee Code</td>
              <td className={cell}>{employeeCode}</td>
            </tr>
          </tbody>
        </table>

        {/* Breakup + attendance + total. */}
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr>
              <th className={`${labelCell} text-center`} style={{ width: "12%" }}>
                S/No.
              </th>
              <th className={`${labelCell} text-left`}>Break up</th>
              <th className={`${labelCell} text-right`} style={{ width: "30%" }}>
                Month wise
              </th>
            </tr>
          </thead>
          <tbody>
            {breakup.map((row, i) => (
              <tr key={row.label}>
                <td className={`${cell} text-center`}>{i + 1}</td>
                <td className={cell}>{row.label}</td>
                <td className={`${cell} text-right tabular-nums`}>{inr(row.amount)}</td>
              </tr>
            ))}

            <tr>
              <td className={cell}></td>
              <td className={cell}>No of days in the month</td>
              <td className={`${cell} text-right tabular-nums`}>{daysInMonth}</td>
            </tr>
            <tr>
              <td className={cell}></td>
              <td className={cell}>No of working days</td>
              <td className={`${cell} text-right tabular-nums`}>{workingDays}</td>
            </tr>
            <tr>
              <td className={cell}></td>
              <td className={cell}>No of days attended</td>
              <td className={`${cell} text-right tabular-nums`}>{daysAttended}</td>
            </tr>
            <tr>
              <td className={cell}></td>
              <td className={labelCell}>Total</td>
              <td className={`${cell} text-right font-bold tabular-nums`}>{inr2(total)}</td>
            </tr>
          </tbody>
        </table>

        {/* Amount in words. */}
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className={labelCell} style={{ width: "20%" }}>
                Amount in words (Rs.)
              </td>
              <td className={cell}>{numberToWords(total)} only</td>
            </tr>
          </tbody>
        </table>

        {/* Date + computer-generated footer. */}
        <p className="mt-4">Date : {fmtDate(record.processedAt ?? record.createdAt)}</p>
        <p className="mt-3 text-center text-[12px] font-semibold italic">
          This is a computer generated document and does not require signatures
        </p>
        <p className="text-center text-[11px] italic">
          (Please attach bills / supports for all claims to avoid delay in reimbursement)
        </p>
      </div>
    </div>
  )
}
