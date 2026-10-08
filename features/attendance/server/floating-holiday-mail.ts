import "server-only"

import { db } from "@/server/db"
import { addEmailAsJob } from "@/lib/queue"
import { SYSTEM_ROLES } from "@/lib/constants"
import { toDateOnly } from "@/lib/dates"
import { renderFloatingHolidayRequestEmail } from "@/lib/email-layout"
import { getConfig, warmConfig } from "@/server/app-config"

// Final deciders on a floating-holiday request; used only as the fallback addressee when the
// applicant has no active manager.
const HR_ROLE_NAMES: string[] = [SYSTEM_ROLES.HR_MANAGER, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.ADMIN_]

export interface FloatingHolidayMailEnvelope {
  /** The approver the letter is addressed to (null when nobody is set up). */
  to: { id: string; name: string; firstName: string; email: string } | null
  /** The HR mailbox on Cc, or null. */
  ccHr: string | null
}

/** Who the letter goes to: the applicant's active manager, else the first HR/admin approver -
 *  never the applicant. */
export async function resolveFloatingHolidayMailEnvelope(
  applicantId: string,
): Promise<FloatingHolidayMailEnvelope> {
  const applicant = await db.employee.findUnique({
    where: { id: applicantId },
    select: {
      manager: {
        select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
      },
    },
  })
  const mgr = applicant?.manager?.isActive ? applicant.manager : null

  const queue = mgr
    ? []
    : await db.employee.findMany({
        where: {
          isActive: true,
          id: { not: applicantId },
          employeeRoles: { some: { role: { name: { in: HR_ROLE_NAMES } } } },
        },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: { createdAt: "asc" },
      })

  const pick = mgr ?? queue[0] ?? null
  const to = pick
    ? {
        id: pick.id,
        name: `${pick.firstName} ${pick.lastName ?? ""}`.trim(),
        firstName: pick.firstName,
        email: pick.email,
      }
    : null

  const hrInbox = (await getConfig("HR_EMAIL"))?.trim() || null
  const ccHr = hrInbox && (!to || hrInbox.toLowerCase() !== to.email.toLowerCase()) ? hrInbox : null

  return { to, ccHr }
}

/** `<key@host>` using the app's own host, so every id we mint looks local. */
function buildMessageId(key: string): string {
  let host = "dnms.digitallynext.com"
  try {
    if (process.env.NEXTAUTH_URL) host = new URL(process.env.NEXTAUTH_URL).host
  } catch {
    // keep the fallback host
  }
  return `<${key}@${host}>`
}

export interface FloatingHolidayLetterInput {
  applicantId: string
  selectionId: string
  holidayName: string
  holidayDate: Date
  reason: string | null
  /** Allowance context stated in the letter. */
  usedCount: number
  limit: number
  year: number
}

export interface PreparedFloatingHolidayLetter {
  applicantId: string
  to: string
  cc: string[] | undefined
  subject: string
  html: string
  text: string
  replyTo: string | undefined
  messageId: string
  references: string
}

/** Build the letter and its envelope without sending (null when there's nobody to address). */
export async function prepareFloatingHolidayLetter(
  input: FloatingHolidayLetterInput,
): Promise<PreparedFloatingHolidayLetter | null> {
  // The signature reads company/social values through getConfigSync().
  await warmConfig()

  const envelope = await resolveFloatingHolidayMailEnvelope(input.applicantId)
  if (!envelope.to) return null

  const applicant = await db.employee.findUnique({
    where: { id: input.applicantId },
    select: {
      firstName: true,
      lastName: true,
      employeeNo: true,
      email: true,
      phone: true,
      jobRole: { select: { name: true } },
      designation: { select: { title: true } },
      department: { select: { name: true } },
    },
  })
  if (!applicant) return null

  const appUrl = (await getConfig("APP_URL")) ?? process.env.NEXTAUTH_URL ?? ""

  const email = renderFloatingHolidayRequestEmail({
    approverFirstName: envelope.to.firstName,
    applicantName: `${applicant.firstName} ${applicant.lastName ?? ""}`.trim(),
    employeeNo: applicant.employeeNo,
    designation: applicant.jobRole?.name ?? applicant.designation?.title ?? null,
    department: applicant.department?.name ?? null,
    applicantEmail: applicant.email,
    applicantPhone: applicant.phone,
    holidayName: input.holidayName,
    date: toDateOnly(input.holidayDate),
    reason: input.reason,
    usedCount: input.usedCount,
    limit: input.limit,
    year: input.year,
    // Approvals live on the holiday calendar's "Requests" tab.
    reviewUrl: appUrl
      ? `${appUrl.replace(/\/$/, "")}/calendar?view=holidays&tab=requests`
      : undefined,
  })

  // Cc the applicant so the letter lands in their mailbox too.
  const cc = [envelope.ccHr, applicant.email].filter(
    (v): v is string => Boolean(v) && v !== envelope.to!.email,
  )

  return {
    applicantId: input.applicantId,
    to: envelope.to.email,
    cc: cc.length ? cc : undefined,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: applicant.email ?? undefined,
    messageId: buildMessageId(`floating-holiday-${input.selectionId}`),
    // Shared References root keeps re-applications on one thread (Gmail rewrites Message-IDs).
    references: buildMessageId(`floating-holiday-thread-${input.selectionId}`),
  }
}

/** Send the application letter as the employee (App Password, else the system mailer): to the
 *  manager, Cc HR and the applicant. Never fails the request. */
export async function sendFloatingHolidayRequestLetter(
  input: FloatingHolidayLetterInput,
): Promise<void> {
  try {
    const letter = await prepareFloatingHolidayLetter(input)
    if (!letter) return

    addEmailAsJob(letter.applicantId, {
      to: letter.to,
      cc: letter.cc,
      subject: letter.subject,
      html: letter.html,
      text: letter.text,
      replyTo: letter.replyTo,
      messageId: letter.messageId,
      references: letter.references,
      profile: "notifications",
    })
  } catch {
    // Non-blocking - email must never fail the request.
  }
}
