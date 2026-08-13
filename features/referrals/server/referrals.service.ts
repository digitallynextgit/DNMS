import "server-only"

import { randomUUID } from "node:crypto"
import { db } from "@/server/db"
import { getConfig } from "@/server/app-config"
import { createNotification } from "@/lib/notifications"
import { NotFoundError, ValidationError } from "@/lib/errors"
import { PERMISSIONS } from "@/lib/constants"
import { monthlyGross, parsePercent, rewardAmount, rewardState } from "../lib/reward"
import { submitReferralSchema, linkHireSchema, markPaidSchema } from "../schemas/referral.schema"

// =============================================================================
// Referrals.
//
// A referral IS a career application - the same row the marketing site writes,
// with a referrer attached. One pipeline, so HR never has two lists to reconcile
// and a referred candidate goes through exactly the same stages as everyone
// else. The only difference is where the row came from and who gets told about
// it afterwards.
// =============================================================================

/** An employee putting somebody forward from inside DNMS. */
export async function submitReferral(referrerId: string, input: unknown) {
  const data = submitReferralSchema.parse(input)

  const role = await db.careerRole.findUnique({
    where: { id: data.careerRoleId },
    select: {
      id: true,
      title: true,
      subDepartment: {
        select: { title: true, group: { select: { code: true, mode: true, slug: true } } },
      },
    },
  })
  if (!role) throw new NotFoundError("Role")

  // Same person, same role, still in play - referring them twice does not make
  // them twice as likely to be hired, and it would create two reward claims.
  const existing = await db.careerApplication.findFirst({
    where: {
      email: data.email,
      careerRoleId: role.id,
      status: { notIn: ["REJECTED"] },
    },
    select: { id: true, referrerId: true },
  })
  if (existing) {
    throw new ValidationError(
      existing.referrerId === referrerId
        ? "You have already referred this person for this role."
        : "This person already has an open application for this role.",
    )
  }

  const id = `app_${randomUUID()}`
  const now = new Date()
  await db.careerApplication.create({
    data: {
      id,
      // Not from the site, so there is no upstream key to replay - the id is
      // unique on its own and keeps the column's NOT NULL contract.
      idempotencyKey: `referral_${id}`,
      mode: role.subDepartment.group.mode,
      groupSlug: role.subDepartment.group.slug,
      departmentSlug: role.subDepartment.title,
      roleSlug: role.id,
      groupCode: role.subDepartment.group.code,
      departmentTitle: role.subDepartment.title,
      roleTitle: role.title,
      careerRoleId: role.id,
      roleResolved: true,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone || "",
      linkedIn: data.linkedIn || "",
      portfolio: "",
      resumeUrl: data.resumeUrl,
      message: data.note || null,
      submittedAt: now,
      sourceUrl: "internal:referral",
      referrerId,
      isInternalReferral: true,
    },
  })

  // HR has to see it, and nothing else in this flow tells them.
  await notifyHrOfReferral(referrerId, data.fullName, role.title)
  return { id }
}

/** Everyone who should hear that a referral landed. */
async function notifyHrOfReferral(referrerId: string, candidate: string, role: string) {
  const [referrer, hr] = await Promise.all([
    db.employee.findUnique({
      where: { id: referrerId },
      select: { firstName: true, lastName: true },
    }),
    // recruitment:write, not a careers-specific scope: careers permissions do
    // not exist in this database, so gating on one would have quietly notified
    // nobody at all.
    db.employee.findMany({
      where: {
        isActive: true,
        employeeRoles: {
          some: {
            role: {
              rolePermissions: {
                some: { permission: { scope: PERMISSIONS.RECRUITMENT_WRITE } },
              },
            },
          },
        },
      },
      select: { id: true },
    }),
  ])
  const who = referrer ? `${referrer.firstName} ${referrer.lastName}`.trim() : "An employee"
  await Promise.all(
    hr.map((h) =>
      createNotification({
        employeeId: h.id,
        title: "New employee referral",
        message: `${who} referred ${candidate} for ${role}.`,
        type: "info",
        link: "/admin/referrals",
      }),
    ),
  )
}

/**
 * Tell the referrer their candidate moved.
 *
 * Called from the application status update, so a referred candidate's referrer
 * finds out the same moment HR records the decision - which is the whole reason
 * somebody refers a friend and then wonders what happened.
 */
export async function notifyReferrerOfStage(applicationId: string) {
  const app = await db.careerApplication.findUnique({
    where: { id: applicationId },
    select: { fullName: true, roleTitle: true, status: true, referrerId: true },
  })
  if (!app?.referrerId) return

  const line: Record<
    string,
    { title: string; message: string; type: "info" | "success" | "error" }
  > = {
    IN_REVIEW: {
      title: "Your referral is being reviewed",
      message: `${app.fullName} (${app.roleTitle}) is now in review.`,
      type: "info",
    },
    SHORTLISTED: {
      title: "Your referral was shortlisted",
      message: `${app.fullName} has been shortlisted for ${app.roleTitle}.`,
      type: "success",
    },
    HIRED: {
      title: "Your referral was hired",
      message: `${app.fullName} has been hired for ${app.roleTitle}. Your reward is due once they complete a year.`,
      type: "success",
    },
    REJECTED: {
      title: "Your referral was not taken forward",
      message: `${app.fullName} was not selected for ${app.roleTitle}. Thanks for the introduction.`,
      type: "info",
    },
  }
  const notif = line[app.status]
  if (!notif) return

  await createNotification({
    employeeId: app.referrerId,
    ...notif,
    link: "/referrals",
  })
}

/** HR links a hired applicant to the employee record created for them. */
export async function linkReferralHire(applicationId: string, input: unknown) {
  const { hiredEmployeeId } = linkHireSchema.parse(input)

  const [app, hire] = await Promise.all([
    db.careerApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true, referrerId: true, fullName: true },
    }),
    db.employee.findUnique({
      where: { id: hiredEmployeeId },
      select: { id: true, firstName: true, lastName: true, dateOfJoining: true },
    }),
  ])
  if (!app) throw new NotFoundError("Application")
  if (!hire) throw new NotFoundError("Employee")
  if (!hire.dateOfJoining) {
    // Without it there is no one-year mark, so the reward could never become
    // due - better to refuse now than to create a claim that silently never pays.
    throw new ValidationError(
      "That employee has no date of joining, so the one-year reward date cannot be worked out. Set it on their profile first.",
    )
  }

  await db.careerApplication.update({
    where: { id: applicationId },
    // Linking a hire IS the hire being confirmed; leaving the stage behind would
    // make the pipeline disagree with itself.
    data: { hiredEmployeeId: hire.id, status: "HIRED" },
  })
  await notifyReferrerOfStage(applicationId)
  return { id: applicationId }
}

/** HR records that the reward has been paid. */
export async function markReferralRewardPaid(applicationId: string, input: unknown) {
  const { amount } = markPaidSchema.parse(input)

  const app = await db.careerApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      referrerId: true,
      fullName: true,
      rewardPaidAt: true,
      hiredEmployee: {
        select: {
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
    },
  })
  if (!app) throw new NotFoundError("Application")
  if (app.rewardPaidAt) throw new ValidationError("This reward is already recorded as paid.")

  const state = rewardState({
    isHired: app.status === "HIRED" && !!app.hiredEmployee,
    hireDateOfJoining: app.hiredEmployee?.dateOfJoining ?? null,
    paidAt: null,
  })
  if (state !== "due") {
    throw new ValidationError(
      state === "none"
        ? "This referral has not been hired and linked yet."
        : "This hire has not completed a year yet.",
    )
  }

  const percent = parsePercent(await getConfig("REFERRAL_REWARD_PERCENT"))
  const computed = app.hiredEmployee?.salaryStructure
    ? rewardAmount(monthlyGross(app.hiredEmployee.salaryStructure), percent)
    : null
  const final = amount ?? computed
  if (final == null) {
    throw new ValidationError(
      "No amount could be worked out - the hire has no salary structure, and no referral percentage is set. Enter the amount explicitly.",
    )
  }

  await db.careerApplication.update({
    where: { id: applicationId },
    // Frozen: the referred person's salary will move, what was paid must not.
    data: { rewardPaidAt: new Date(), rewardAmount: final },
  })

  if (app.referrerId) {
    await createNotification({
      employeeId: app.referrerId,
      title: "Referral reward paid",
      message: `Your reward for referring ${app.fullName} has been processed.`,
      type: "success",
      link: "/referrals",
    })
  }
  return { id: applicationId, amount: final }
}

export interface EligibilityRunResult {
  checked: number
  notified: number
}

/**
 * Tell referrers (and HR) when a referred hire reaches one year.
 *
 * Runs daily. Only ever notifies ONCE per referral - rewardNotifiedAt is the
 * latch, because a reward that is due stays due until somebody pays it, and a
 * daily "you are owed money" is how people start ignoring notifications.
 *
 * The referrer having since LEFT does not block it: they made the introduction
 * that produced a year of service, and that is what the reward is for.
 */
export async function runReferralEligibility(now = new Date()): Promise<EligibilityRunResult> {
  const oneYearAgo = new Date(now.getTime() - 365 * 86_400_000)

  const due = await db.careerApplication.findMany({
    where: {
      status: "HIRED",
      referrerId: { not: null },
      rewardPaidAt: null,
      rewardNotifiedAt: null,
      hiredEmployee: { is: { dateOfJoining: { not: null, lte: oneYearAgo } } },
    },
    select: {
      id: true,
      fullName: true,
      roleTitle: true,
      referrerId: true,
      hiredEmployee: {
        select: {
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
    },
  })

  if (due.length === 0) return { checked: 0, notified: 0 }

  const percent = parsePercent(await getConfig("REFERRAL_REWARD_PERCENT"))
  let notified = 0

  for (const app of due) {
    const amount = app.hiredEmployee?.salaryStructure
      ? rewardAmount(monthlyGross(app.hiredEmployee.salaryStructure), percent)
      : null

    if (app.referrerId) {
      await createNotification({
        employeeId: app.referrerId,
        title: "Referral reward is due",
        message: `${app.fullName} has completed a year. Your referral reward${
          amount ? ` of ${amount.toLocaleString("en-IN")}` : ""
        } is now payable.`,
        type: "success",
        link: "/referrals",
      })
      notified++
    }

    await db.careerApplication.update({
      where: { id: app.id },
      data: { rewardNotifiedAt: now },
    })
  }

  return { checked: due.length, notified }
}
