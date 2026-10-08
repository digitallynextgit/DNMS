import "server-only"

import { randomUUID } from "node:crypto"
import { db } from "@/server/db"
import { createNotifications } from "@/lib/notifications"
import { PERMISSIONS } from "@/lib/constants"
import { getObjectKey, isB2Configured, uploadFile } from "@/lib/storage"
import type { CareersApplicationInput } from "../schemas/application.schema"

// Rule: NEVER lose an applicant - closed/deleted roles and repeats are stored and flagged for HR.

export interface CreateApplicationResult {
  id: string
  status: "received"
  duplicate: boolean
  /** Set when the application was stored but needs HR's attention. */
  warning?: "ROLE_CLOSED" | "REPEAT_APPLICATION"
}

/** Same person + role inside this window with a NEW idempotency key = a repeat (retries reuse the key). */
const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000

/** Null when the role is gone or unpublished - expected, since the site serves a cached tree. */
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

/** Non-blocking, and forced: an API-key request has no session and a human is waiting. */
async function notifyHr(app: {
  id: string
  fullName: string
  roleTitle: string
  roleResolved: boolean
}) {
  try {
    // By PERMISSION, not role name, so hr_employee (who does the triage) is notified too.
    const recipients = await db.employee.findMany({
      where: {
        isActive: true,
        status: "ACTIVE",
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

// resumeUrl points at the marketing site's storage and can expire, so copy the CV into our bucket.
// Best-effort: never blocks or fails the application.
const RESUME_MAX_BYTES = 15 * 1024 * 1024
const RESUME_FETCH_TIMEOUT_MS = 20_000

async function copyResumeToStorage(applicationId: string, resumeUrl: string): Promise<void> {
  try {
    if (!(await isB2Configured())) return
    const url = new URL(resumeUrl)
    if (url.protocol !== "https:") return

    const res = await fetch(url, { signal: AbortSignal.timeout(RESUME_FETCH_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`fetch ${res.status}`)
    const declared = Number(res.headers.get("content-length") ?? 0)
    if (declared > RESUME_MAX_BYTES) throw new Error(`too large (${declared} bytes)`)
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length === 0 || buffer.length > RESUME_MAX_BYTES) {
      throw new Error(`bad size (${buffer.length} bytes)`)
    }

    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "application/pdf"
    const fileName = decodeURIComponent(url.pathname.split("/").pop() || "resume.pdf")
    const key = getObjectKey("careers/resumes", fileName, applicationId)
    await uploadFile(key, buffer, contentType, buffer.length)
    await db.careerApplication.update({
      where: { id: applicationId },
      data: { resumeKey: key },
    })
  } catch (err) {
    // A null resumeKey records that no copy exists; the external link still works.
    console.error(`[careers-application] resume copy failed for ${applicationId}:`, err)
  }
}

/** Employee number or email -> employee id. Case-insensitive, trimmed; inactive employees still match. */
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
  // Idempotent replay: the site retries with the same key.
  const existing = await db.careerApplication.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true },
  })
  if (existing) return { id: existing.id, status: "received", duplicate: true }

  const mode = input.mode === "internship" ? "INTERNSHIP" : "FULL_TIME"
  const careerRoleId = await resolveRole(mode, input.groupId, input.departmentId, input.roleId)

  const repeat = await db.careerApplication.findFirst({
    where: {
      email: input.applicant.email,
      roleSlug: input.roleId,
      createdAt: { gte: new Date(Date.now() - REPEAT_WINDOW_MS) },
    },
    select: { id: true },
  })

  // Stored verbatim even if unmatched: a typo is still something HR can act on.
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
    // Concurrent retries of the same key: the loser re-reads the winner's row.
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

  // Fire-and-forget: the candidate's 201 must not wait on a 15MB download.
  void copyResumeToStorage(id, input.applicant.resumeUrl)

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
