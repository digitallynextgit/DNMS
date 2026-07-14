import "server-only"

import { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { SYSTEM_ROLES } from "@/lib/constants"
import { requireAnyRole } from "@/server/action-guard"
import { createAuditLog } from "@/lib/audit"
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
// Accrual starts once probation is COMPLETED (no leave accrues during probation).
// All paid types - including Earned Leave - begin accruing right at probation end,
// whether probation is 3 or 6 months. Contract staff accrue after 6 months service.
// Accrued days are rounded to the nearest half-day (the smallest takeable unit).
// =============================================================================

// Admins (and the hidden admin_ watch account) don't take leave, so they're
// excluded from allocation, monthly accrual, and rollover - no balances are
// ever created for them.
const LEAVE_EXEMPT_ROLES = [SYSTEM_ROLES.ADMIN_, SYSTEM_ROLES.ADMIN]
const NOT_LEAVE_EXEMPT = {
  NOT: { employeeRoles: { some: { role: { name: { in: LEAVE_EXEMPT_ROLES } } } } },
}

type EmployeeAccrualInfo = {
  employmentType: string
  dateOfJoining: Date | null
  confirmationDate: Date | null
  probationMonths: number
}

/**
 * When the employee completes probation - no leave accrues before this date.
 * Mirrors the canonical probation rule (features/employees/probation.ts):
 * confirmed early -> the recorded confirmation date; otherwise joining +
 * probationMonths.
 */
function probationCompletion(emp: EmployeeAccrualInfo): Date | null {
  if (emp.confirmationDate) return emp.confirmationDate
  if (emp.dateOfJoining) {
    const d = new Date(emp.dateOfJoining)
    d.setMonth(d.getMonth() + (emp.probationMonths || 6))
    return d
  }
  return null
}

/** When leave starts accruing for an employee (no accrual during probation). */
function accrualStartDate(emp: EmployeeAccrualInfo): Date | null {
  // Contract staff: paid leave only after 6 months of service (then 1/month).
  if (emp.employmentType === "CONTRACT") {
    if (!emp.dateOfJoining) return null
    const d = new Date(emp.dateOfJoining)
    d.setMonth(d.getMonth() + 6)
    return d
  }
  // Everyone else: leave accrues once probation is COMPLETED - including Earned
  // Leave, which now starts right at probation end (3- or 6-month probation
  // alike), not a further 6 months later.
  const completion = probationCompletion(emp)
  return completion ?? emp.dateOfJoining
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

/** Round to the nearest half-day - the smallest unit an employee can take. */
function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}

/**
 * Eligible months in `year` = from accrual start to year-end (Dec). Used to
 * PRORATE the annual entitlement for someone eligible only part of the year, e.g.
 * probation ending 01 Jun → eligible Jun–Dec = 7 months → 7/12 of the entitlement.
 * Confirmed for the whole year → 12.
 */
export function eligibleMonthsInYear(year: number, startDate: Date | null): number {
  let startMonth = 1
  if (startDate) {
    const sy = startDate.getFullYear()
    if (sy > year) return 0 // becomes eligible only after this year
    if (sy === year) startMonth = startDate.getMonth() + 1
  }
  return Math.max(0, Math.min(12, 12 - startMonth + 1))
}

/**
 * Days that should have accrued so far: the (already prorated) annual allocation
 * spread evenly over the months the employee is eligible this year. Upfront types
 * make the whole allocation available at once; monthly types release
 * allocated / eligibleMonths per elapsed month, capped at the allocation.
 */
function accruedTarget(
  accrualMethod: string,
  allocated: number,
  eligibleMonths: number,
  monthsElapsed: number,
): number {
  if (allocated <= 0 || eligibleMonths <= 0) return 0
  if (accrualMethod === "UPFRONT") return allocated
  const rate = allocated / eligibleMonths
  return Math.min(allocated, roundToHalf(rate * monthsElapsed))
}

function entitlementFor(
  type: { id: string; maxDaysPerYear: number },
  policyMap: Map<string, number>,
): number {
  const fromPolicy = policyMap.get(type.id)
  return fromPolicy !== undefined ? fromPolicy : type.maxDaysPerYear
}

// ─── Shared policy context ───────────────────────────────────────────────────
// The leave-type table and the policy matrix are the SAME for every employee, so
// a bulk run (resync / rollover) loads them ONCE and passes them down instead of
// re-reading them per employee.
type LeaveTypeRow = {
  id: string
  code: string
  maxDaysPerYear: number
  accrualMethod: string
  isPaid: boolean
}

export type AccrualContext = {
  types: LeaveTypeRow[]
  /** employmentType → (leaveTypeId → daysPerYear) */
  policyByEmploymentType: Map<string, Map<string, number>>
}

/** Load the leave types + full policy matrix once, for a bulk accrual run. */
export async function loadAccrualContext(): Promise<AccrualContext> {
  const [types, policies] = await Promise.all([
    db.leaveType.findMany({
      where: { isActive: true },
      select: { id: true, code: true, maxDaysPerYear: true, accrualMethod: true, isPaid: true },
    }),
    db.leavePolicy.findMany({
      select: { employmentType: true, leaveTypeId: true, daysPerYear: true },
    }),
  ])
  const policyByEmploymentType = new Map<string, Map<string, number>>()
  for (const p of policies) {
    let m = policyByEmploymentType.get(p.employmentType)
    if (!m) {
      m = new Map<string, number>()
      policyByEmploymentType.set(p.employmentType, m)
    }
    m.set(p.leaveTypeId, p.daysPerYear)
  }
  return { types, policyByEmploymentType }
}

type EmployeePolicyInfo = EmployeeAccrualInfo & { gender: string | null }

/**
 * Seed/refresh an employee's balances for a year from the policy matrix.
 * Sets `allocated` (entitlement) and `accrued` (pro-rated by elapsed months).
 * Skips types with zero entitlement (unlimited / not granted).
 *
 * `opts` lets a bulk caller supply the already-loaded employee row and the
 * shared leave-type/policy context so this does no per-employee lookup reads.
 */
export async function allocateFromPolicy(
  employeeId: string,
  year: number,
  opts?: { employee?: EmployeePolicyInfo; ctx?: AccrualContext; skipUsedFloor?: boolean },
): Promise<number> {
  const employee =
    opts?.employee ??
    (await db.employee.findUnique({
      where: { id: employeeId },
      select: {
        employmentType: true,
        dateOfJoining: true,
        confirmationDate: true,
        probationMonths: true,
        gender: true,
      },
    }))
  if (!employee) return 0

  const ctx = opts?.ctx ?? (await loadAccrualContext())
  const types = ctx.types
  const policyMap =
    ctx.policyByEmploymentType.get(employee.employmentType) ?? new Map<string, number>()

  // No paid leave accrues until accrual begins (probation completed; contract
  // staff after 6 months). While accrual hasn't started, the employee is "on
  // probation" and only unpaid leave (e.g. LWP) applies.
  const start = accrualStartDate(employee)
  const onProbation = !!start && new Date() < start
  // Earned Leave unlocks only 6 months AFTER probation ends (policy G).
  const elStart = start ? addMonths(start, 6) : null

  // Existing rows for this employee/year, read once so the writes below can be
  // batched (was: an upsert or deleteMany PER leave type).
  const existing = await db.leaveBalance.findMany({
    where: { employeeId, year },
    select: { id: true, leaveTypeId: true, allocated: true, accrued: true },
  })
  const existingByType = new Map(existing.map((b) => [b.leaveTypeId, b]))

  const toDelete: string[] = []
  const toCreate: {
    employeeId: string
    leaveTypeId: string
    year: number
    allocated: number
    accrued: number
    used: number
    pending: number
    carried: number
  }[] = []
  const toUpdate: { id: string; allocated: number; accrued: number }[] = []

  let count = 0
  for (const type of types) {
    const entitlement = entitlementFor(type, policyMap)
    // EL accrues from probation + 6 months; every other type from probation end.
    const typeStart = type.code === "EL" ? elStart : start
    const eligibleMonths = eligibleMonthsInYear(year, typeStart)
    const monthsElapsed = monthsAccrued(year, typeStart)
    // Prorate the annual entitlement to the months the employee is eligible this
    // year (probation ending 01 Jun → 7/12; confirmed all year → full).
    const allocated = roundToHalf((entitlement / 12) * eligibleMonths)
    // Maternity Leave is granted to female employees only.
    const maternityBlocked = type.code === "ML" && employee.gender !== "FEMALE"
    // Paid leave is not granted during probation - only unpaid leave.
    const paidBlockedOnProbation = type.isPaid && onProbation
    if (allocated <= 0 || maternityBlocked || paidBlockedOnProbation) {
      // Not granted (0 entitlement / not yet eligible this year; maternity for a
      // non-female; any paid leave during probation) - remove any lingering row.
      toDelete.push(type.id)
      continue
    }
    const accrued = accruedTarget(type.accrualMethod, allocated, eligibleMonths, monthsElapsed)
    const row = existingByType.get(type.id)
    if (!row) {
      toCreate.push({
        employeeId,
        leaveTypeId: type.id,
        year,
        allocated,
        accrued,
        used: 0,
        pending: 0,
        carried: 0,
      })
    } else if (row.allocated !== allocated || row.accrued !== accrued) {
      // Same result as the old unconditional upsert-update, minus the no-op writes.
      toUpdate.push({ id: row.id, allocated, accrued })
    }
    count++
  }

  const writes: Prisma.PrismaPromise<unknown>[] = []
  if (toDelete.length > 0) {
    writes.push(
      db.leaveBalance.deleteMany({ where: { employeeId, year, leaveTypeId: { in: toDelete } } }),
    )
  }
  if (toCreate.length > 0) writes.push(db.leaveBalance.createMany({ data: toCreate }))
  for (const u of toUpdate) {
    writes.push(
      db.leaveBalance.update({
        where: { id: u.id },
        data: { allocated: u.allocated, accrued: u.accrued },
      }),
    )
  }
  if (writes.length > 0) await db.$transaction(writes)

  // Never let accrued fall below what's already used. A bulk caller passes
  // `skipUsedFloor` and runs the identical statement ONCE for all its employees.
  if (!opts?.skipUsedFloor) {
    await db.$executeRaw`UPDATE "leave_balances" SET "accrued" = "used" WHERE "employee_id" = ${employeeId} AND "year" = ${year} AND "accrued" < "used"`
  }
  return count
}

/** The `accrued >= used` floor, applied to a whole batch of employees at once. */
async function applyUsedFloor(employeeIds: string[], year: number): Promise<void> {
  if (employeeIds.length === 0) return
  await db.$executeRaw`UPDATE "leave_balances" SET "accrued" = "used" WHERE "year" = ${year} AND "accrued" < "used" AND "employee_id" IN (${Prisma.join(employeeIds)})`
}

/** Update only `accrued` from the current `allocated` (idempotent monthly job). */
export async function recomputeAccrued(employeeId: string, year: number): Promise<number> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      employmentType: true,
      dateOfJoining: true,
      confirmationDate: true,
      probationMonths: true,
      gender: true,
    },
  })
  if (!employee) return 0

  const balances = await db.leaveBalance.findMany({
    where: { employeeId, year },
    include: { leaveType: { select: { accrualMethod: true, code: true, isPaid: true } } },
  })

  const start = accrualStartDate(employee)
  const onProbation = !!start && new Date() < start
  const elStart = start ? addMonths(start, 6) : null

  let count = 0
  for (const b of balances) {
    // Drop balances that shouldn't exist: maternity for a non-female, or any
    // paid leave while still on probation (only unpaid leave applies then).
    if (
      (b.leaveType.code === "ML" && employee.gender !== "FEMALE") ||
      (b.leaveType.isPaid && onProbation)
    ) {
      await db.leaveBalance.delete({ where: { id: b.id } })
      count++
      continue
    }
    const typeStart = b.leaveType.code === "EL" ? elStart : start
    const eligibleMonths = eligibleMonthsInYear(year, typeStart)
    const monthsElapsed = monthsAccrued(year, typeStart)
    const target = accruedTarget(
      b.leaveType.accrualMethod,
      b.allocated,
      eligibleMonths,
      monthsElapsed,
    )
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
    where: { isActive: true, status: { in: ["ACTIVE", "ON_LEAVE"] }, ...NOT_LEAVE_EXEMPT },
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
  // Leave types + policy matrix are employee-independent - load them once.
  const [employees, ctx] = await Promise.all([
    db.employee.findMany({
      where: { isActive: true, status: { in: ["ACTIVE", "ON_LEAVE"] }, ...NOT_LEAVE_EXEMPT },
      select: {
        id: true,
        employmentType: true,
        dateOfJoining: true,
        confirmationDate: true,
        probationMonths: true,
        gender: true,
      },
    }),
    loadAccrualContext(),
  ])

  let carriedCount = 0
  for (const e of employees) {
    const prev = await db.leaveBalance.findMany({
      where: { employeeId: e.id, year: fromYear },
      include: { leaveType: { select: { id: true, carryForward: true, maxCarryDays: true } } },
    })
    await allocateFromPolicy(e.id, toYear, { employee: e, ctx })
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
    // Employees + the (employee-independent) leave types & policy matrix are read
    // ONCE; allocateFromPolicy then does zero lookup queries per employee.
    const [employees, ctx] = await Promise.all([
      db.employee.findMany({
        where: { isActive: true, status: { in: ["ACTIVE", "ON_LEAVE"] }, ...NOT_LEAVE_EXEMPT },
        select: {
          id: true,
          employmentType: true,
          dateOfJoining: true,
          confirmationDate: true,
          probationMonths: true,
          gender: true,
        },
      }),
      loadAccrualContext(),
    ])
    let balances = 0
    for (const e of employees) {
      balances += await allocateFromPolicy(e.id, resolvedYear, {
        employee: e,
        ctx,
        skipUsedFloor: true,
      })
    }
    // One `accrued >= used` floor pass for every employee we just touched.
    await applyUsedFloor(
      employees.map((e) => e.id),
      resolvedYear,
    )

    await createAuditLog(session, {
      action: "RESYNC",
      module: "leave",
      entityType: "LeaveBalance",
      changes: { year: resolvedYear, employees: employees.length, balances },
    })
    return ok(serialize({ year: resolvedYear, employees: employees.length, balances }))
  })
}
