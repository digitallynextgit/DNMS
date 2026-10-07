// =============================================================================
// Payroll: a salary structure for everyone, PAID payslips for the last three
// months and a DRAFT run for the current month (the Payroll Directory opens on
// the current month, so without it the page would be empty).
//
// Numbers follow app/api/payroll/records/route.ts exactly:
//   payable days walk every calendar day - off days, approved floating
//   holidays and future days are paid; PRESENT/LATE = 1; HALF_DAY = 0.5;
//   paid leave = 1 (also counted as leaveDays); anything else is loss of pay.
//   earning = structure value * payableDays / 30 (2 dp); statutory
//   deductions are off (STATUTORY_DEDUCTIONS_ENABLED = false), so net = gross.
// Two deliberate kindnesses: an approved WFH day and the birthday day off are
// paid (the generator has no rule for either and would dock them).
// =============================================================================

import { DEMO_FORMER_PEOPLE, DEMO_PEOPLE } from "@/features/help/demo/dataset"
import {
  addDays,
  at,
  awayOn,
  dayKey,
  firstOfMonth,
  idOf,
  isWeekend,
  lastOfMonth,
  makeMany,
  type DemoContext,
} from "./context"
import { randomUUID } from "node:crypto"

const MODULE = "Payroll"
const STANDARD_MONTH_DAYS = 30
const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * HR adjustments made while a run was still DRAFT (the payslip editor's "Other
 * deductions", the only deduction this app produces with statutory deductions
 * switched off). By month offset: -1 = last month. Loss-of-pay days are not
 * deductions here - the generator prorates them out of gross instead.
 *
 * GUIDE REQUIREMENT (payroll): the Deductions column is not ₹0 on every row.
 */
const ADJUSTMENTS: { who: string; month: number; amount: number; note: string }[] = [
  { who: "priya", month: -2, amount: 1500, note: "Salary advance recovery (1 of 2)." },
  { who: "priya", month: -1, amount: 1500, note: "Salary advance recovery (2 of 2)." },
  {
    who: "arjun",
    month: -1,
    amount: 2500,
    note: "Recovery for a damaged camera lens (shared cost).",
  },
  { who: "ishaan", month: -3, amount: 1000, note: "Client dinner bill above the policy limit." },
]

function structureFor(gross: number) {
  const basic = Math.round(gross * 0.5)
  const hra = Math.round(basic * 0.4)
  const conveyance = 1600
  const medicalAllowance = 1250
  const telephoneAllowance = gross >= 45000 ? 1000 : 500
  const otherAllowances = gross - basic - hra - conveyance - medicalAllowance - telephoneAllowance
  return {
    basicSalary: basic,
    hra,
    conveyance,
    medicalAllowance,
    telephoneAllowance,
    otherAllowances,
  }
}

export async function seedPayroll(ctx: DemoContext): Promise<void> {
  const { db } = await import("@/server/db")

  // ── salary structures ──────────────────────────────────────────────────────
  const appraisal = new Date(Date.UTC(ctx.today.getUTCFullYear(), 3, 1)) // 1 April
  const structures = new Map<string, { id: string; s: ReturnType<typeof structureFor> }>()
  const ssRows: Record<string, unknown>[] = []
  const employees = new Map<string, { joined: Date; dob: string | null }>()
  // The leaver is paid up to their last working day (left: "YYYY-MM-DD").
  const everyone = [...DEMO_PEOPLE, ...DEMO_FORMER_PEOPLE]
  for (const p of everyone) {
    const emp = (await db.employee.findUnique({
      where: { id: idOf(ctx, p.key) },
      select: { dateOfJoining: true, dateOfBirth: true },
    }))!
    const joined = emp.dateOfJoining!
    employees.set(p.key, { joined, dob: emp.dateOfBirth ? dayKey(emp.dateOfBirth).slice(5) : null })
    const s = structureFor(p.monthlyGross)
    const id = randomUUID()
    structures.set(p.key, { id, s })
    const effectiveFrom = joined > appraisal ? joined : appraisal
    ssRows.push({
      id,
      employeeId: idOf(ctx, p.key),
      ...s,
      pfEmployee: 0,
      pfEmployer: 0,
      esi: 0,
      tds: 0,
      effectiveFrom,
      createdAt: at(effectiveFrom, "11:00"),
    })
  }
  await makeMany(ctx, "salaryStructure", ssRows)
  ctx.summary.add(MODULE, "salary structures", ssRows.length)

  // ── payroll runs ───────────────────────────────────────────────────────────
  const recRows: Record<string, unknown>[] = []
  const perStatus: Record<string, number> = {}
  for (const delta of [-3, -2, -1, 0]) {
    const first = firstOfMonth(ctx.today, delta)
    const last = lastOfMonth(ctx.today, delta)
    const month = first.getUTCMonth() + 1
    const year = first.getUTCFullYear()
    const daysInMonth = last.getUTCDate()
    const status = delta === 0 ? "DRAFT" : "PAID"

    for (const p of everyone) {
      const emp = employees.get(p.key)!
      const st = structures.get(p.key)!
      const left = ctx.ref[`left:${p.key}`]
      if (emp.joined > last) continue // joined after this month
      if (left && dayKey(first) > left) continue // had left before this month
      const attendance = ctx.attendance[p.key] ?? new Map<string, string>()
      let payable = 0
      let lop = 0
      let leaveDays = 0
      for (let d = first; d <= last; d = addDays(d, 1)) {
        const key = dayKey(d)
        if (d < emp.joined) continue
        if (left && key > left) continue // after the last working day: not employed
        const away = awayOn(ctx, p.key, d)
        if (isWeekend(d) || ctx.holidayKeys.has(key) || away === "FLOATING") {
          payable += 1
          continue
        }
        if (d > ctx.today) {
          payable += 1
          continue
        }
        const att = attendance.get(key)
        if (att === "PRESENT" || att === "LATE") payable += 1
        else if (att === "HALF_DAY") {
          payable += 0.5
          lop += 0.5
        } else if (away === "LEAVE_PAID") {
          payable += 1
          leaveDays += 1
        } else if (away === "WFH" || (emp.dob && key.slice(5) === emp.dob)) payable += 1
        else if (away === "LEAVE_UNPAID" || away === "LEAVE_PENDING" || away === "ABSENT") lop += 1
        else if (attendance.size === 0 || d < firstOfMonth(ctx.today, -2))
          payable += 1 // before the punch history
        else lop += 1
      }
      payable = r2(payable)
      lop = r2(lop)
      const ratio = payable / STANDARD_MONTH_DAYS
      const e = {
        basicSalary: r2(st.s.basicSalary * ratio),
        hra: r2(st.s.hra * ratio),
        conveyance: r2(st.s.conveyance * ratio),
        medicalAllowance: r2(st.s.medicalAllowance * ratio),
        telephoneAllowance: r2(st.s.telephoneAllowance * ratio),
        otherAllowances: r2(st.s.otherAllowances * ratio),
      }
      const gross = r2(Object.values(e).reduce((a, b) => a + b, 0))
      const adjustment = ADJUSTMENTS.find((a) => a.who === p.key && a.month === delta)
      const other = adjustment?.amount ?? 0
      const processedAt = status === "PAID" ? at(last, "17:30") : null
      recRows.push({
        employeeId: idOf(ctx, p.key),
        salaryStructureId: st.id,
        month,
        year,
        workingDays: daysInMonth,
        presentDays: payable,
        leaveDays,
        lopDays: lop,
        ...e,
        overtime: 0,
        grossSalary: gross,
        pfEmployee: 0,
        pfEmployer: 0,
        esi: 0,
        tds: 0,
        otherDeductions: other,
        totalDeductions: other,
        netSalary: r2(Math.max(0, gross - other)),
        status,
        processedAt,
        approvedById: status === "PAID" ? idOf(ctx, "aarav") : null,
        paidAt: status === "PAID" ? at(addDays(last, 1), "11:00") : null,
        notes: [
          status === "PAID"
            ? "Paid by bank transfer (NEFT)."
            : "Draft - attendance still open for this month.",
          adjustment?.note,
          left && dayKey(last) >= left ? "Full and final settlement." : null,
        ]
          .filter(Boolean)
          .join(" "),
        createdAt: status === "PAID" ? at(last, "16:00") : at(ctx.today, "10:00"),
      })
      perStatus[`${year}-${String(month).padStart(2, "0")} ${status}`] =
        (perStatus[`${year}-${String(month).padStart(2, "0")} ${status}`] ?? 0) + 1
    }
  }
  await makeMany(ctx, "payrollRecord", recRows)
  ctx.summary.add(MODULE, "payslips", recRows.length)
  for (const [k, n] of Object.entries(perStatus)) ctx.summary.add(MODULE, `  ${k}`, n)
}
