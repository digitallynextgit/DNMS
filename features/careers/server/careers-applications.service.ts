import "server-only"

import { randomUUID } from "node:crypto"
import { db } from "@/server/db"
import { createNotifications } from "@/lib/notifications"
import type { CareersApplicationInput } from "../schemas/application.schema"

// Applications posted by the marketing site. The guiding rule throughout: NEVER
// lose an applicant. A closed role, a deleted role, a repeat submission - all of
// them still get stored and flagged for HR rather than rejected.

export interface CreateApplicationResult {
  id: string
  status: "received"
  duplicate: boolean
  /** Set when the application was stored but needs HR's attention. */
  warning?: "ROLE_CLOSED" | "REPEAT_APPLICATION"
}

/** A re-application by the same person for the same role inside this window is
 *  flagged as a repeat (a DIFFERENT idempotency key, i.e. a real second submit -
 *  a network retry reuses the key and is handled as an idempotent replay). */
const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Resolve the published slugs back to the live CareerRole.
 * Returns null when the role no longer exists or is no longer PUBLISHED - the
 * site serves a cached/snapshotted tree, so this is expected, not exceptional.
 */
async function resolveRole(
  mode: "FULL_TIME" | "INTERNSHIP",
  groupSlug: string,
  departmentSlug: string,
  roleSlug: string,
): Promise<string | null> {
  const role = await db.careerRole.findFirst({
    where: {
      slug: roleSlug,
      status: "PUBLISHED",
      subDepartment: {
        slug: departmentSlug,
        status: "PUBLISHED",
        group: { slug: groupSlug, mode, status: "PUBLISHED" },
      },
    },
    select: { id: true },
  })
  return role?.id ?? null
}

/** Tell HR someone applied. Non-blocking + forced: an application arriving via an
 *  API key has no session, and this is a direct "a human is waiting" signal. */
async function notifyHr(app: {
  id: string
  fullName: string
  roleTitle: string
  roleResolved: boolean
}) {
  try {
    const recipients = await db.employee.findMany({
      where: {
        isActive: true,
        status: "ACTIVE",
        employeeRoles: { some: { role: { name: { in: ["hr_manager", "admin"] } } } },
      },
      select: { id: true },
    })
    if (recipients.length === 0) return

    await createNotifications(
      recipients.map((r) => ({
        employeeId: r.id,
        title: "New career application",
        message: `${app.fullName} applied for ${app.roleTitle}.${
          app.roleResolved ? "" : " (Role is closed/unlisted - please review.)"
        }`,
        type: app.roleResolved ? ("info" as const) : ("warning" as const),
        link: `/recruitment/applications?id=${app.id}`,
      })),
      { force: true },
    )
  } catch (err) {
    // Never let a notification failure cost us the application.
    console.error("[careers-application] notify failed:", err)
  }
}

/**
 * What the candidate typed -> employee id, or null.
 *
 * Accepts an employee NUMBER or a work EMAIL, because employee numbers here are
 * bare digits ("145", "7") plus a few odd ones ("SA-002", "EMP-PENDING-4"): a
 * candidate cannot guess that, and most employees do not know their own number
 * offhand. An email is the thing a colleague actually passes on.
 *
 * Matched case-insensitively and trimmed - this is typed by a candidate reading
 * it off a WhatsApp message, so " 145 " and "sa-002" must both land. An INACTIVE
 * employee still resolves: they made the introduction while they were here, and
 * the record should say so.
 */
async function resolveReferrer(typed: string): Promise<string | null> {
  const value = typed.trim()
  if (!value) return null

  const match = await db.employee.findFirst({
    where: {
      OR: [
        { employeeNo: { equals: value, mode: "insensitive" } },
        { email: { equals: value, mode: "insensitive" } },
        { personalEmail: { equals: value, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  })
  return match?.id ?? null
}

export async function createCareerApplication(
  input: CareersApplicationInput,
): Promise<CreateApplicationResult> {
  // 1. Idempotent replay - the site retries on network failure with the same key.
  const existing = await db.careerApplication.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true },
  })
  if (existing) return { id: existing.id, status: "received", duplicate: true }

  const mode = input.mode === "internship" ? "INTERNSHIP" : "FULL_TIME"
  const careerRoleId = await resolveRole(mode, input.groupId, input.departmentId, input.roleId)

  // 2. A genuine re-apply (different key, same person + role, recent).
  const repeat = await db.careerApplication.findFirst({
    where: {
      email: input.applicant.email,
      roleSlug: input.roleId,
      createdAt: { gte: new Date(Date.now() - REPEAT_WINDOW_MS) },
    },
    select: { id: true },
  })

  // 3. Resolve the referrer, if the candidate named one. Stored verbatim either
  //    way: an id that matches nobody is a typo HR can still act on, and losing
  //    it would erase the only record that a referral was ever claimed.
  const referrerEmployeeNo = input.referrerEmployeeNo?.trim() || null
  const referrerId = referrerEmployeeNo ? await resolveReferrer(referrerEmployeeNo) : null

  const id = `app_${randomUUID()}`
  try {
    await db.careerApplication.create({
      data: {
        id,
        idempotencyKey: input.idempotencyKey,
        mode,
        groupSlug: input.groupId,
        departmentSlug: input.departmentId,
        roleSlug: input.roleId,
        groupCode: input.groupCode,
        departmentTitle: input.departmentTitle,
        roleTitle: input.roleTitle,
        opening: input.opening ?? null,
        careerRoleId,
        roleResolved: careerRoleId !== null,
        fullName: input.applicant.fullName,
        email: input.applicant.email,
        phone: input.applicant.phone,
        linkedIn: input.applicant.linkedIn,
        portfolio: input.applicant.portfolio,
        resumeUrl: input.applicant.resumeUrl,
        message: input.applicant.message ?? null,
        submittedAt: new Date(input.meta.submittedAt),
        sourceUrl: input.meta.sourceUrl,
        isRepeat: repeat !== null,
        referrerEmployeeNo: referrerEmployeeNo,
        referrerId,
      },
    })
  } catch (err) {
    // Two concurrent retries of the same key: the loser re-reads the winner's row
    // instead of failing (the site would otherwise fall back to email and double-send).
    const dup = await db.careerApplication.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    })
    if (dup) return { id: dup.id, status: "received", duplicate: true }
    throw err
  }

  await notifyHr({
    id,
    fullName: input.applicant.fullName,
    roleTitle: input.roleTitle,
    roleResolved: careerRoleId !== null,
  })

  return {
    id,
    status: "received",
    duplicate: false,
    ...(careerRoleId === null
      ? { warning: "ROLE_CLOSED" as const }
      : repeat
        ? { warning: "REPEAT_APPLICATION" as const }
        : {}),
  }
}
