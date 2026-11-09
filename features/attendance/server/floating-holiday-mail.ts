import "server-only"

import { db } from "@/server/db"
import { addEmailAsJob, addEmailJob } from "@/lib/queue"
import { SYSTEM_ROLES } from "@/lib/constants"
import { toDateOnly } from "@/lib/dates"
import {
  floatingHolidayRequestSubject,
  renderFloatingHolidayDecisionLetter,
  renderFloatingHolidayRequestEmail,
} from "@/lib/email-layout"
import { getConfig, warmConfig } from "@/server/app-config"

// Final deciders on a floating-holiday request; used only as the fallback addressee when the
// applicant has no active manager.
const HR_ROLE_NAMES: string[] = [SYSTEM_ROLES.HR_MANAGER, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.ADMIN_]

export interface FloatingHolidayMailEnvelope {
  /** The approver the letter is addressed to (null when nobody is set up). */
  to: { id: string; name: string; firstName: string; email: string } | null
  /** The HR mailbox on Cc, or null. */
  ccHr: string | null
  /** The dotted manager on Cc when the letter goes to someone else, or null. */
  ccManager: string | null
}

/** Who the letter goes to: the applicant's active manager (else the dotted one), else the
 *  first HR/admin approver - never the applicant. */
export async function resolveFloatingHolidayMailEnvelope(
  applicantId: string,
): Promise<FloatingHolidayMailEnvelope> {
  const applicant = await db.employee.findUnique({
    where: { id: applicantId },
    select: {
      manager: {
        select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
      },
      dottedManager: {
        select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
      },
    },
  })
  const mgr = applicant?.manager?.isActive ? applicant.manager : null
  const dotted = applicant?.dottedManager?.isActive ? applicant.dottedManager : null

  const queue =
    mgr || dotted
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

  const pick = mgr ?? dotted ?? queue[0] ?? null
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
  const ccManager = dotted && dotted.id !== to?.id ? dotted.email : null

  return { to, ccHr, ccManager }
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

const applicationMessageId = (selectionId: string) =>
  buildMessageId(`floating-holiday-${selectionId}`)
// Gmail rewrites Message-IDs sent through smtp.gmail.com, so In-Reply-To alone can break the thread.
const threadRootId = (selectionId: string) =>
  buildMessageId(`floating-holiday-thread-${selectionId}`)

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
  const cc = [envelope.ccHr, envelope.ccManager, applicant.email].filter(
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
    messageId: applicationMessageId(input.selectionId),
    // Shared References root keeps re-applications on one thread.
    references: threadRootId(input.selectionId),
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

export interface FloatingHolidayDecisionInput {
  selectionId: string
  employeeId: string
  approved: boolean
  holidayName: string
  holidayDate: Date
  reason: string | null
  /** Null for the hidden owner account, which is never named to staff: company signature. */
  deciderId: string | null
  deciderIsHrManager: boolean
}

export interface PreparedFloatingHolidayDecision {
  senderId: string | null
  to: string
  cc: string[] | undefined
  subject: string
  html: string
  text: string
  replyTo: string | undefined
  messageId: string
  inReplyTo: string
  references: string[]
  profile: "hr" | "notifications"
}

/** Build HR's reply without sending (null when the employee is gone). */
export async function prepareFloatingHolidayDecision(
  input: FloatingHolidayDecisionInput,
): Promise<PreparedFloatingHolidayDecision | null> {
  // The signature reads company/social values through getConfigSync().
  await warmConfig()

  const managerSelect = { select: { email: true, isActive: true } }
  const [employee, signer, hrInbox] = await Promise.all([
    db.employee.findUnique({
      where: { id: input.employeeId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        manager: managerSelect,
        dottedManager: managerSelect,
      },
    }),
    input.deciderId
      ? db.employee.findUnique({
          where: { id: input.deciderId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            jobRole: { select: { name: true } },
            designation: { select: { title: true } },
          },
        })
      : null,
    getConfig("HR_EMAIL"),
  ])
  if (!employee) return null

  const date = toDateOnly(input.holidayDate)
  const applicantName = `${employee.firstName} ${employee.lastName ?? ""}`.trim()
  const original = floatingHolidayRequestSubject(applicantName, input.holidayName, date)

  const email = renderFloatingHolidayDecisionLetter({
    employeeFirstName: employee.firstName,
    approved: input.approved,
    holidayName: input.holidayName,
    date,
    reason: input.approved ? null : input.reason,
    subject: `Re: ${original}`,
    approverName: signer ? `${signer.firstName} ${signer.lastName ?? ""}`.trim() : "Digitally Next",
    approverDesignation: signer?.jobRole?.name ?? signer?.designation?.title ?? null,
    approverEmail: signer?.email ?? null,
    approverPhone: signer?.phone ?? null,
  })

  // Everyone from the application stays on the thread, minus the sender and the recipient.
  const onThread = new Set([employee.email, signer?.email].map((e) => e?.toLowerCase()))
  const cc = [
    ...new Set(
      [
        hrInbox?.trim(),
        employee.manager?.isActive ? employee.manager.email : null,
        employee.dottedManager?.isActive ? employee.dottedManager.email : null,
      ].filter((e): e is string => Boolean(e) && !onThread.has(e?.toLowerCase())),
    ),
  ]

  return {
    senderId: signer?.id ?? null,
    to: employee.email,
    cc: cc.length ? cc : undefined,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: signer?.email ?? undefined,
    // A rejected request can be re-applied on the same row, so each decision needs its own id.
    messageId: buildMessageId(`floating-holiday-decision-${input.selectionId}-${Date.now()}`),
    inReplyTo: applicationMessageId(input.selectionId),
    references: [threadRootId(input.selectionId), applicationMessageId(input.selectionId)],
    profile: input.deciderIsHrManager ? "hr" : "notifications",
  }
}

/** HR's final decision, sent as a reply on the application's mail thread. Never fails the request. */
export async function sendFloatingHolidayDecisionLetter(
  input: FloatingHolidayDecisionInput,
): Promise<void> {
  try {
    const prepared = await prepareFloatingHolidayDecision(input)
    if (!prepared) return

    const { senderId, ...mail } = prepared
    if (senderId) addEmailAsJob(senderId, mail)
    else addEmailJob(mail)
  } catch (err) {
    console.error("[FLOATING_HOLIDAY_DECISION_MAIL]", err)
  }
}
