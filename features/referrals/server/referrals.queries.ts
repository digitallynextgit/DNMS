import "server-only"

import { db } from "@/server/db"
import { getConfig } from "@/server/app-config"
import {
  daysToGo,
  eligibleOn,
  monthlyGross,
  parsePercent,
  rewardAmount,
  rewardState,
} from "../lib/reward"
import type { ReferralRow, ReferralStage, ReferralSummary } from "../types"

/** Everything a referral row needs, in one shape both readers share. */
const REFERRAL_SELECT = {
  id: true,
  fullName: true,
  email: true,
  roleTitle: true,
  departmentTitle: true,
  status: true,
  submittedAt: true,
  isInternalReferral: true,
  rewardAmount: true,
  rewardPaidAt: true,
  referrerEmployeeNo: true,
  referrer: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
  hiredEmployee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfJoining: true,
      salaryStructure: {
        select: {
          basicSalary: true,
          hra: true,
          conveyance: true,
          medicalAllowance: true,
          telephoneAllowance: true,
          otherAllowances: true,
        },
      },
    },
  },
} as const

type Row =
  Awaited<ReturnType<typeof db.careerApplication.findFirst>> extends never
    ? never
    : Awaited<ReturnType<typeof fetchRows>>[number]

async function fetchRows(where: Record<string, unknown>) {
  return db.careerApplication.findMany({
    where,
    select: REFERRAL_SELECT,
    orderBy: { submittedAt: "desc" },
  })
}

/**
 * Shape one stored application into the row the UI renders.
 *
 * The reward is DERIVED here rather than stored: hire link, joining date and
 * payout stamp already contain the answer, and a stored status is one more
 * thing that can drift out of step with them. Once paid, the frozen amount
 * wins - the referred person's salary moves on, what was paid does not.
 */
function toRow(r: Row, percent: number | null, now: Date): ReferralRow {
  const hire = r.hiredEmployee
  const joining = hire?.dateOfJoining ?? null
  const state = rewardState({
    isHired: r.status === "HIRED" && !!hire,
    hireDateOfJoining: joining,
    paidAt: r.rewardPaidAt,
    now,
  })
  const estimated = hire?.salaryStructure
    ? rewardAmount(monthlyGross(hire.salaryStructure), percent)
    : null

  return {
    id: r.id,
    fullName: r.fullName,
    email: r.email,
    roleTitle: r.roleTitle,
    departmentTitle: r.departmentTitle,
    stage: r.status as ReferralStage,
    submittedAt: r.submittedAt.toISOString(),
    isInternalReferral: r.isInternalReferral,
    hire: hire
      ? {
          id: hire.id,
          name: `${hire.firstName} ${hire.lastName}`.trim(),
          dateOfJoining: joining?.toISOString() ?? null,
        }
      : null,
    reward: {
      state,
      eligibleOn: eligibleOn(joining)?.toISOString() ?? null,
      daysToGo: state === "pending" ? daysToGo(joining, now) : null,
      amount: r.rewardPaidAt ? Number(r.rewardAmount ?? 0) || null : estimated,
      paidAt: r.rewardPaidAt?.toISOString() ?? null,
    },
  }
}

/**
 * The roles an employee may refer somebody to.
 *
 * Deliberately NOT the admin careers tree: that one is gated on
 * recruitment:read, which only HR holds - pointing the referral form at it left
 * every ordinary employee looking at an empty dropdown, which is everyone the
 * feature exists for. This returns the published job board only, which is
 * already public on the careers site, so an employee seeing it leaks nothing.
 */
export async function getReferableRoles(): Promise<
  { id: string; title: string; department: string }[]
> {
  const roles = await db.careerRole.findMany({
    where: {
      status: "PUBLISHED",
      // A published role inside a draft department is not actually advertised;
      // referring into it would put a candidate in a pipeline nobody is running.
      subDepartment: { status: "PUBLISHED", group: { status: "PUBLISHED" } },
    },
    select: {
      id: true,
      title: true,
      order: true,
      subDepartment: { select: { title: true, order: true } },
    },
  })

  return roles
    .sort(
      (a, b) =>
        a.subDepartment.title.localeCompare(b.subDepartment.title) ||
        a.order - b.order ||
        a.title.localeCompare(b.title),
    )
    .map((r) => ({ id: r.id, title: r.title, department: r.subDepartment.title }))
}

/** The percent once per request, not once per row. */
async function currentPercent(): Promise<number | null> {
  return parsePercent(await getConfig("REFERRAL_REWARD_PERCENT"))
}

/** Everyone this employee has referred, newest first. */
export async function getMyReferrals(
  employeeId: string,
): Promise<{ rows: ReferralRow[]; summary: ReferralSummary; me: { employeeNo: string } }> {
  const [rows, percent, me] = await Promise.all([
    fetchRows({ referrerId: employeeId }),
    currentPercent(),
    // Their own id, so the page can tell them what to pass on. Nobody knows
    // their employee number offhand, and "ask HR" is how a referral goes
    // unclaimed.
    db.employee.findUnique({ where: { id: employeeId }, select: { employeeNo: true } }),
  ])
  const now = new Date()
  const mapped = rows.map((r) => toRow(r, percent, now))

  return {
    me: { employeeNo: me?.employeeNo ?? "" },
    rows: mapped,
    summary: {
      total: mapped.length,
      hired: mapped.filter((r) => r.stage === "HIRED").length,
      inProgress: mapped.filter((r) => !["HIRED", "REJECTED"].includes(r.stage)).length,
      rejected: mapped.filter((r) => r.stage === "REJECTED").length,
      rewardDue: mapped.filter((r) => r.reward.state === "due").length,
      rewardPaid: mapped.filter((r) => r.reward.state === "paid").length,
      earned: mapped
        .filter((r) => r.reward.state === "paid")
        .reduce((sum, r) => sum + (r.reward.amount ?? 0), 0),
    },
  }
}

/** Every referral in the business - HR's queue. */
export async function getAllReferrals(): Promise<
  (ReferralRow & {
    referrer: { id: string; name: string; employeeNo: string } | null
    claimedEmployeeNo: string | null
  })[]
> {
  const [rows, percent] = await Promise.all([
    // Anything that CLAIMS a referrer, resolved or not: an employee number that
    // matched nobody is exactly what HR needs to see and fix by hand.
    fetchRows({ OR: [{ referrerId: { not: null } }, { referrerEmployeeNo: { not: null } }] }),
    currentPercent(),
  ])
  const now = new Date()
  return rows.map((r) => ({
    ...toRow(r, percent, now),
    referrer: r.referrer
      ? {
          id: r.referrer.id,
          name: `${r.referrer.firstName} ${r.referrer.lastName}`.trim(),
          employeeNo: r.referrer.employeeNo,
        }
      : null,
    claimedEmployeeNo: r.referrerEmployeeNo,
  }))
}
