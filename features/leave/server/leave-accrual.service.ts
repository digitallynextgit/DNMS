import "server-only"

import { db } from "@/server/db"
import { SYSTEM_ROLES } from "@/lib/constants"
import { requireAnyRole } from "@/server/action-guard"
import { ok, runAction, serialize, type ActionResult } from "@/server/action-result"

// =============================================================================
// Leave allocation & monthly accrual
// =============================================================================
// Entitlement comes from the LeavePolicy matrix (employmentType -> leaveType ->
// daysPerYear), falling back to LeaveType.maxDaysPerYear when no row exists.
//
// `allocated` on a balance = the annual entitlement (the cap; HR may override it
// and that override sticks). `accrued` = how much of that has become available so
// far this year. Availability = accrued + carried - used - pending.
//
//   - allocateFromPolicy(): seeds/refreshes `allocated` from policy. Runs on
//     employee create, annual rollover, and the manual HR "re-sync". Overwrites
//     `allocated`, so it is an explicit action, never the routine monthly job.
//   - recomputeAccrued(): updates only `accrued` from the existing `allocated`.
//     This is the idempotent, self-healing monthly job; it never touches
//     `allocated`, so HR overrides survive.
//
// Accrual respects a per-type START date: most types accrue from joining, but
// Earned Leave (EL) only begins after probation + 6 months (existing policy).
// =============================================================================

type EmployeeAccrualInfo = {
  employmentType: string
  dateOfJoining: Date | null
  probationEndDate: Date | null
  confirmationDate: Date | null
  probationMonths: number
}

/** When the employee completes probation. No leave accrues before this date. */
function probationCompletion(emp: EmployeeAccrualInfo): Date | null {
  // Confirmed early -> the confirmation date wins; else the planned probation end;
  // else derive it from joining + probationMonths.
  if (emp.confirmationDate) return emp.confirmationDate
  if (emp.probationEndDate) return emp.probationEndDate
  if (emp.dateOfJoining) {
    const d = new Date(emp.dateOfJoining)
    d.setMonth(d.getMonth() + (emp.probationMonths || 6))
    return d
  }
  return null
}

/** When a given leave type starts accruing for an employee. */
function accrualStartDate(typeCode: string, emp: EmployeeAccrualInfo): Date | null {
  // Contract staff: paid leave only after 6 months of service (then 1/month).
  if (emp.employmentType === "CONTRACT") {
    if (!emp.dateOfJoining) return null
    const d = new Date(emp.dateOfJoining)
    d.setMonth(d.getMonth() + 6)
    return d
  }
  // Everyone else: leave only accrues once probation is COMPLETED.
  const completion = probationCompletion(emp)
  if (!completion) return emp.dateOfJoining
  if (typeCode === "EL") {
    // Earned Leave begins a further 6 months after probation completion.
    const eligible = new Date(completion)
    eligible.setMonth(eligible.getMonth() + 6)
    return eligible
  }
  return completion
}

/** Completed accrual months for `year` given the date accrual starts. */
export function monthsAccrued(year: number, startDate: Date | null): number {
  const now = new Date()
  const cy = now.getFullYear()
  const cm = now.getMonth() + 1 // 1-12
  if (year > cy) return 0
  let startMonth = 1
  if (startDate) {
    const sy = startDate.getFullYear()
    if (sy > year) return 0 // accrual starts after this year
    if (sy === year) startMonth = startDate.getMonth() + 1
  }
  const endMonth = year < cy ? 12 : cm
  return Math.max(0, Math.min(12, endMonth - startMonth + 1))
}

/** Days that should have accrued given the entitlement, method and elapsed months. */
function accruedTarget(accrualMethod: string, allocated: number, months: number): number {
  if (allocated <= 0) return 0
  if (accrualMethod === "UPFRONT") return allocated
  const rate = allocated / 12
  return Math.min(allocated, Math.round(rate * months * 100) / 100)
}

function entitlementFor(
  type: { id: string; maxDaysPerYear: number },
  policyMap: Map<string, number>,
): number {
  const fromPolicy = policyMap.get(type.id)
  return fromPolicy !== undefined ? fromPolicy : type.maxDaysPerYear
}

/**
 * Seed/refresh an employee's balances for a year from the policy matrix.
 * Sets `allocated` (entitlement) and `accrued` (pro-rated by elapsed months).
 * Skips types with zero entitlement (unlimited / not granted).
 */
export async function allocateFromPolicy(employeeId: string, year: number): Promise<number> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      employmentType: true,
      dateOfJoining: true,
      probationEndDate: true,
      confirmationDate: true,
      probationMonths: true,
    },
  })
  if (!employee) return 0

  const [types, policies] = await Promise.all([
    db.leaveType.findMany({
      where: { isActive: true },
      select: { id: true, code: true, maxDaysPerYear: true, accrualMethod: true },
    }),
    db.leavePolicy.findMany({ where: { employmentType: employee.employmentType } }),
  ])
  const policyMap = new Map(policies.map((p) => [p.leaveTypeId, p.daysPerYear]))

  let count = 0
  for (const type of types) {
    const entitlement = entitlementFor(type, policyMap)
    if (entitlement <= 0) {
      // No entitlement for this employment type (e.g. interns get 0 paid leave) -
      // clear any previously-allocated balance so it doesn't linger.
      await db.leaveBalance.updateMany({
        where: { employeeId, leaveTypeId: type.id, year },
        data: { allocated: 0, accrued: 0 },
      })
      continue
    }
    const months = monthsAccrued(year, accrualStartDate(type.code, employee))
    const accrued = accruedTarget(type.accrualMethod, entitlement, months)
    await db.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: type.id, year } },
      update: { allocated: entitlement, accrued },
      create: {
        employeeId,
        leaveTypeId: type.id,
        year,
        allocated: entitlement,
        accrued,
        used: 0,
        pending: 0,
        carried: 0,
      },
    })
    count++
  }
  // Never let accrued fall below what's already used.
  await db.$executeRaw`UPDATE "leave_balances" SET "accrued" = "used" WHERE "employee_id" = ${employeeId} AND "year" = ${year} AND "accrued" < "used"`
  return count
}

/** Update only `accrued` from the current `allocated` (idempotent monthly job). */
export async function recomputeAccrued(employeeId: string, year: number): Promise<number> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      employmentType: true,
      dateOfJoining: true,
      probationEndDate: true,
      confirmationDate: true,
      probationMonths: true,
    },
  })
  if (!employee) return 0

  const balances = await db.leaveBalance.findMany({
    where: { employeeId, year },
    include: { leaveType: { select: { accrualMethod: true, code: true } } },
  })

  let count = 0
  for (const b of balances) {
    const months = monthsAccrued(year, accrualStartDate(b.leaveType.code, employee))
    const target = accruedTarget(b.leaveType.accrualMethod, b.allocated, months)
    const accrued = Math.max(target, b.used)
    if (accrued !== b.accrued) {
      await db.leaveBalance.update({ where: { id: b.id }, data: { accrued } })
      count++
    }
  }
  return count
}

/** Monthly accrual across all active employees (cron). */
export async function runMonthlyAccrual(
  year: number,
): Promise<{ employees: number; updated: number }> {
  const employees = await db.employee.findMany({
    where: { isActive: true, status: { in: ["ACTIVE", "ON_LEAVE"] } },
    select: { id: true },
  })
  let updated = 0
  for (const e of employees) updated += await recomputeAccrued(e.id, year)
  return { employees: employees.length, updated }
}

/** Annual rollover: seed next year's balances + carry forward leftover (capped). */
export async function rolloverYear(
  toYear: number,
): Promise<{ employees: number; carried: number }> {
  const fromYear = toYear - 1
  const employees = await db.employee.findMany({
    where: { isActive: true, status: { in: ["ACTIVE", "ON_LEAVE"] } },
    select: { id: true },
  })

  let carriedCount = 0
  for (const e of employees) {
    const prev = await db.leaveBalance.findMany({
      where: { employeeId: e.id, year: fromYear },
      include: { leaveType: { select: { id: true, carryForward: true, maxCarryDays: true } } },
    })
    await allocateFromPolicy(e.id, toYear)
    for (const b of prev) {
      if (!b.leaveType.carryForward) continue
      const leftover = Math.max(0, b.accrued + b.carried - b.used)
      const carry = Math.min(b.leaveType.maxCarryDays || 0, leftover)
      if (carry > 0) {
        await db.leaveBalance.updateMany({
          where: { employeeId: e.id, leaveTypeId: b.leaveType.id, year: toYear },
          data: { carried: carry },
        })
        carriedCount++
      }
    }
  }
  return { employees: employees.length, carried: carriedCount }
}

// ─── Public action: HR "re-sync balances" ────────────────────────────────────
export async function resyncLeaveBalances(year?: number): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireAnyRole([SYSTEM_ROLES.HR_MANAGER, SYSTEM_ROLES.ADMIN])
    const resolvedYear = year ?? new Date().getFullYear()
    const employees = await db.employee.findMany({
      where: { isActive: true, status: { in: ["ACTIVE", "ON_LEAVE"] } },
      select: { id: true },
    })
    let balances = 0
    for (const e of employees) balances += await allocateFromPolicy(e.id, resolvedYear)

    await db.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "RESYNC",
        module: "leave",
        entityType: "LeaveBalance",
        changes: { year: resolvedYear, employees: employees.length, balances },
      },
    })
    return ok(serialize({ data: { year: resolvedYear, employees: employees.length, balances } }))
  })
}
