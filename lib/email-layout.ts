// =============================================================================
// Shared branded email layout. Centralizes the brand name, logo header and
// footer that were duplicated across the welcome, password-reset and inline
// approve/reject emails. Table-based + inline styles for email-client safety.
// =============================================================================

import { getConfigSync } from "@/server/app-config"
import { cleanLeaveTypeForLetter } from "@/lib/utils"

export const BRAND_NAME = "Digitally Next"

export function logoUrl(): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")
  return getConfigSync("EMAIL_LOGO_URL") || `${base}/logo_dark_bg.webp`
}

/** The signature uses the standalone brand mark (public/brand-mark.png), not the
 *  wordmark used in the email header. */
export function signatureLogoUrl(): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")
  return `${base}/brand-mark.png`
}

/** A single "Label / value" row for a details card (omitted when value is empty). */
export function detailRow(label: string, value?: string | null): string {
  if (!value) return ""
  return `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid #f0f0f0;">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#9ca3af;">${label}</div>
        <div style="font-size:15px; color:#111827; margin-top:2px;">${value}</div>
      </td>
    </tr>`
}

/** Wrap inner body HTML in the standard branded card (logo header + footer). */
export function wrapEmail({ title, bodyHtml }: { title: string; bodyHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:12px;">
    <tr>
      <td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%; background:#ffffff; border-radius:5px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#171717 0%,#0a0a0a 100%); padding:32px 32px 28px;">
              <img src="${logoUrl()}" alt="${BRAND_NAME}" height="34" style="height:34px; width:auto; display:block; border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 8px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#fafafa; border-top:1px solid #f0f0f0; padding:20px 32px;">
              <p style="margin:0; font-size:12px; color:#c4c4c8;">
                &copy; 2026 ${BRAND_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// Escape user-provided text before inlining it into email HTML.
function escapeHtml(value?: string | null): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// "2026-08-23" -> "23 Aug 2026" (no Date dependency, timezone-safe).
function formatEmailDate(ymd?: string | null): string | null {
  if (!ymd) return null
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]
  return `${d} ${months[m - 1]} ${y}`
}

/**
 * Build the email HR receives when an employee submits a resignation request.
 * Sent from the employee's own mailbox (so the manager can be CC'd and reply).
 */
export function renderResignationRequestEmail(input: {
  employeeName: string
  employeeNo: string
  department?: string | null
  designation?: string | null
  reason?: string | null
  /** "yyyy-MM-dd" */
  lastWorkingDate?: string | null
  reviewUrl?: string
}): { subject: string; html: string; text: string } {
  const { employeeName, employeeNo, department, designation, reason, lastWorkingDate, reviewUrl } =
    input
  const name = escapeHtml(employeeName)
  const role = designation ? escapeHtml(designation) : "my position"
  const subject = `Resignation - ${employeeName}`
  const lwd = formatEmailDate(lastWorkingDate)
  const reasonTrimmed = reason?.trim() || ""
  const reasonHtml = reasonTrimmed ? escapeHtml(reasonTrimmed).replace(/\n/g, "<br />") : ""

  const sigParts = [designation, employeeNo, department].filter(Boolean) as string[]
  const sigMetaText = sigParts.join(" · ")
  const sigMetaHtml = sigParts.map(escapeHtml).join(" · ")

  const para = "margin:0 0 16px; font-size:15px; line-height:1.7; color:#374151;"
  const reasonParagraph = reasonHtml
    ? `<p style="${para}">${reasonHtml}</p>`
    : `<p style="${para}">After careful consideration, I have decided to move on to pursue new opportunities.</p>`

  const body = `
    <p style="margin:0 0 18px; font-size:15px; color:#111827;">Dear HR,</p>

    <p style="${para}">
      I am writing to formally notify you of my resignation from ${role} at ${BRAND_NAME}. My requested last working day is <strong style="color:#111827;">${lwd ?? "to be confirmed"}</strong>.
    </p>

    ${reasonParagraph}

    <p style="${para}">
      During my time at ${BRAND_NAME}, I have truly valued the growth and experiences I have gained. I am committed to ensuring a smooth handover and will do my best to wrap up my responsibilities and support the transition before my departure.
    </p>

    <p style="margin:0 0 26px; font-size:15px; line-height:1.7; color:#374151;">
      Thank you for the guidance and support throughout my time here. I sincerely appreciate the opportunities I have been given.
    </p>

    <p style="margin:0; font-size:15px; color:#111827;">Sincerely,</p>
    <p style="margin:4px 0 0; font-size:15px; font-weight:600; color:#111827;">${name}</p>
    ${sigMetaHtml ? `<p style="margin:2px 0 0; font-size:13px; color:#6b7280;">${sigMetaHtml}</p>` : ""}

    ${
      reviewUrl
        ? `<p style="margin:30px 0 0; padding-top:14px; border-top:1px solid #f0f0f0; font-size:12px; color:#9ca3af;">HR &amp; the reporting manager can <a href="${reviewUrl}" style="color:#6b7280;">review this resignation in ${BRAND_NAME}</a>.</p>`
        : ""
    }`

  const text = `Dear HR,

I am writing to formally notify you of my resignation from ${designation ?? "my position"} at ${BRAND_NAME}. My requested last working day is ${lwd ?? "to be confirmed"}.

${reasonTrimmed || "After careful consideration, I have decided to move on to pursue new opportunities."}

During my time at ${BRAND_NAME}, I have truly valued the growth and experiences I have gained. I am committed to ensuring a smooth handover and will do my best to wrap up my responsibilities and support the transition before my departure.

Thank you for the guidance and support throughout my time here. I sincerely appreciate the opportunities I have been given.

Sincerely,
${employeeName}${sigMetaText ? `\n${sigMetaText}` : ""}
${reviewUrl ? `\nReview: ${reviewUrl}` : ""}`

  return { subject, html: wrapEmail({ title: subject, bodyHtml: body }), text }
}

/**
 * HR's reply to a resignation: a proper acceptance or decline letter, addressed
 * to the employee. Use a "Re: Resignation - <name>" subject so it threads.
 */
export function renderResignationDecisionEmail(input: {
  approved: boolean
  employeeName: string
  firstName: string
  /** "yyyy-MM-dd" - the confirmed last working day (approvals). */
  lastWorkingDate?: string | null
  /** Reviewer's note shared with the employee. */
  note?: string | null
  reviewerName?: string | null
}): { subject: string; html: string; text: string } {
  const { approved, employeeName, firstName, lastWorkingDate, note, reviewerName } = input
  const name = escapeHtml(firstName)
  const subject = `Re: Resignation - ${employeeName}`
  const lwd = formatEmailDate(lastWorkingDate)
  const signoff = reviewerName ? escapeHtml(reviewerName) : "HR Team"
  const noteHtml = note?.trim() ? escapeHtml(note.trim()).replace(/\n/g, "<br />") : ""
  const para = "margin:0 0 16px; font-size:15px; line-height:1.7; color:#374151;"

  const bodyLines = approved
    ? `
    <p style="${para}">
      Thank you for your message. This is to formally confirm that your resignation has been
      <strong style="color:#16a34a;">accepted</strong>. Your last working day is
      <strong style="color:#111827;">${lwd ?? "as discussed"}</strong>.
    </p>
    ${noteHtml ? `<p style="${para}">${noteHtml}</p>` : ""}
    <p style="${para}">
      We sincerely appreciate everything you have contributed during your time at ${BRAND_NAME} and
      wish you all the very best in your next chapter. Our HR team will be in touch regarding the
      offboarding and handover formalities.
    </p>`
    : `
    <p style="${para}">
      Thank you for your message. After careful consideration, your resignation request has
      <strong style="color:#dc2626;">not been accepted</strong> at this time.
    </p>
    ${noteHtml ? `<p style="${para}">${noteHtml}</p>` : ""}
    <p style="${para}">
      Please reach out to your manager or the HR team so we can discuss the next steps together.
    </p>`

  const body = `
    <p style="margin:0 0 18px; font-size:15px; color:#111827;">Dear ${name},</p>
    ${bodyLines}
    <p style="margin:24px 0 0; font-size:15px; color:#111827;">${approved ? "Warm regards," : "Regards,"}</p>
    <p style="margin:4px 0 0; font-size:15px; font-weight:600; color:#111827;">${signoff}</p>
    <p style="margin:2px 0 0; font-size:13px; color:#6b7280;">${BRAND_NAME}</p>`

  const text = `Dear ${firstName},

${
  approved
    ? `This is to formally confirm that your resignation has been accepted. Your last working day is ${lwd ?? "as discussed"}.`
    : `After careful consideration, your resignation request has not been accepted at this time.`
}
${note?.trim() ? `\n${note.trim()}\n` : ""}
${
  approved
    ? `We sincerely appreciate your contributions to ${BRAND_NAME} and wish you all the best. HR will be in touch regarding offboarding.`
    : `Please reach out to your manager or HR to discuss the next steps.`
}

${approved ? "Warm regards," : "Regards,"}
${signoff}
${BRAND_NAME}`

  return { subject, html: wrapEmail({ title: subject, bodyHtml: body }), text }
}

/**
 * Build an approve/reject decision email (leave, WFH, resignation, etc.).
 * `kind` is the request label ("Leave request", "WFH request"…).
 */
export function renderDecisionEmail(input: {
  kind: string
  approved: boolean
  firstName: string
  /** A short summary line, e.g. "Annual Leave · 12 Jun – 14 Jun". */
  detailLine?: string
  /** Reviewer's reason/note (shown for rejections, optional otherwise). */
  reason?: string | null
  loginUrl?: string
}): { subject: string; html: string; text: string } {
  const { kind, approved, firstName, detailLine, reason, loginUrl } = input
  const verb = approved ? "approved" : "rejected"
  const accent = approved ? "#16a34a" : "#dc2626"
  const subject = `${kind} ${verb}`

  const body = `
    <h1 style="margin:0 0 14px; font-size:20px; font-weight:600; color:${accent};">${kind} ${verb}</h1>
    <p style="margin:0 0 18px; font-size:15px; line-height:1.6; color:#4b5563;">
      Hi ${firstName}, your ${kind.toLowerCase()} has been <strong>${verb}</strong>.
    </p>
    ${detailLine ? `<p style="margin:0 0 14px; font-size:14px; color:#111827;">${detailLine}</p>` : ""}
    ${reason ? `<p style="margin:0 0 14px; font-size:14px; color:#4b5563;"><strong>Reason:</strong> ${reason}</p>` : ""}
    ${
      loginUrl
        ? `<p style="margin:18px 0 0; font-size:14px; color:#4b5563;"><a href="${loginUrl}" style="color:#2563eb;">Log in to ${BRAND_NAME}</a> to view details.</p>`
        : ""
    }`

  const text = `Hi ${firstName}, your ${kind.toLowerCase()} has been ${verb}.${
    detailLine ? `\n\n${detailLine}` : ""
  }${reason ? `\n\nReason: ${reason}` : ""}\n\n- ${BRAND_NAME}`

  return { subject, html: wrapEmail({ title: subject, bodyHtml: body }), text }
}

/**
 * The employee's email signature block, mirroring the one staff use in Gmail:
 * logo | name / designation / socials / phone / website / email / address.
 *
 * Company-level bits (website, address, socials) come from app settings, so they
 * can be corrected without a redeploy; a blank social is simply omitted rather
 * than rendering a dead link. Table-based + inline styles because Gmail/Outlook
 * strip <style> blocks and ignore flexbox.
 */
export function renderSignature(input: {
  name: string
  designation?: string | null
  email?: string | null
  phone?: string | null
}): string {
  const { name, designation, email, phone } = input
  const website = getConfigSync("COMPANY_WEBSITE") || ""
  const address = getConfigSync("COMPANY_ADDRESS") || ""
  const socials = [
    { label: "LinkedIn", url: getConfigSync("SOCIAL_LINKEDIN") || "" },
    { label: "Instagram", url: getConfigSync("SOCIAL_INSTAGRAM") || "" },
    { label: "YouTube", url: getConfigSync("SOCIAL_YOUTUBE") || "" },
  ].filter((s) => s.url)

  // Reference palette.
  const RED = "#e5231b"
  const TEAL = "#25c1c1"
  const INK = "#1a1a1a"
  const BODY = "#374151"

  const body = `font-size:12px; color:${BODY};`
  const link = `color:${BODY}; text-decoration:none;`
  const websiteHref = website.startsWith("http") ? website : `https://${website}`

  // Teal social pills, top-right, in the reference's order (only the ones with a
  // configured URL - an email shouldn't link a pill to nowhere).
  const order = ["YouTube", "Instagram", "LinkedIn"]
  const socialPills = order
    .map((label) => socials.find((s) => s.label.toLowerCase() === label.toLowerCase()))
    .filter((s): s is { label: string; url: string } => Boolean(s?.url))
    .map(
      (s) =>
        `<a href="${s.url}" style="display:inline-block; background:${TEAL}; color:#ffffff; font-size:11px; font-weight:600; text-decoration:none; padding:3px 9px; margin-left:6px;">${escapeHtml(s.label)}</a>`,
    )
    .join("")

  // Phone and website share a row, like the reference.
  const contactLine = [
    phone ? `<span style="${body}">${escapeHtml(phone)}</span>` : "",
    website ? `<a href="${websiteHref}" style="${link}">${escapeHtml(website)}</a>` : "",
  ]
    .filter(Boolean)
    .join(`<span style="${body}">&nbsp;&nbsp;&nbsp;&nbsp;</span>`)

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
      <tr>
        <td style="padding-right:16px; vertical-align:top;">
          <img src="${signatureLogoUrl()}" alt="${BRAND_NAME}" height="52" style="height:52px; width:auto; display:block; border:0;" />
        </td>
        <td style="vertical-align:top;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
            <tr>
              <td style="vertical-align:top;">
                <div style="font-size:15px; font-weight:700; color:${INK};">${escapeHtml(name)}</div>
                <div style="font-size:13px; font-weight:700; color:${INK}; margin-top:1px;">${
                  designation ? `${escapeHtml(designation)}, ${BRAND_NAME}` : BRAND_NAME
                }</div>
              </td>
              ${socialPills ? `<td align="right" style="vertical-align:top; white-space:nowrap;">${socialPills}</td>` : ""}
            </tr>
          </table>
          <div style="border-top:1.5px solid ${RED}; margin:10px 0;"></div>
          ${contactLine ? `<div style="margin:0 0 5px;">${contactLine}</div>` : ""}
          ${email ? `<div style="margin:0 0 5px;"><a href="mailto:${escapeHtml(email)}" style="${link}">${escapeHtml(email)}</a></div>` : ""}
          ${address ? `<div style="${body} max-width:440px;">${escapeHtml(address)}</div>` : ""}
          <div style="border-top:1.5px solid ${RED}; margin-top:12px;"></div>
        </td>
      </tr>
    </table>`
}

/**
 * The leave application, written AS THE EMPLOYEE and addressed to their manager
 * (HR is CC'd). It reads like a letter the employee sent, not a system alert -
 * the previous version was an unbranded one-liner that didn't even include the
 * reason, so the manager was asked to decide without being told why.
 */
export function renderLeaveRequestEmail(input: {
  /** First name of the manager the letter is addressed to. */
  approverFirstName: string
  applicantName: string
  employeeNo?: string | null
  designation?: string | null
  department?: string | null
  /** For the signature block. */
  applicantEmail?: string | null
  applicantPhone?: string | null
  leaveType: string
  /** "yyyy-MM-dd" */
  startDate: string
  endDate: string
  totalDays: number
  reason?: string | null
  /** When set, this REPLACES the auto-composed letter body (the greeting through
   *  "Best Regards,") - it's the text the employee edited in the preview. The
   *  signature and review link are still appended automatically. */
  bodyText?: string | null
  /** When set, REPLACES the auto subject line (edited in the preview). */
  subjectText?: string | null
  reviewUrl?: string
}): { subject: string; html: string; text: string } {
  const {
    approverFirstName,
    applicantName,
    employeeNo,
    designation,
    department,
    applicantEmail,
    applicantPhone,
    leaveType,
    startDate,
    endDate,
    totalDays,
    reason,
    bodyText,
    subjectText,
    reviewUrl,
  } = input

  const start = formatEmailDate(startDate) ?? startDate
  const end = formatEmailDate(endDate) ?? endDate
  const dates = start === end ? start : `${start} to ${end}`
  const dayLabel = `${totalDays} day${totalDays === 1 ? "" : "s"}`
  // The letter to the manager shouldn't expose payroll qualifiers - "Leave
  // Without Pay (Unpaid)" reads simply as "leave". Other types stay natural
  // (e.g. "casual leave", "sick leave").
  const type = cleanLeaveTypeForLetter(leaveType)
  const subject = subjectText?.trim() || `Leave application - ${applicantName} - ${dates}`

  const reasonTrimmed = reason?.trim() || ""
  const reasonHtml = reasonTrimmed ? escapeHtml(reasonTrimmed).replace(/\n/g, "<br />") : ""
  const para = "margin:0 0 16px; font-size:15px; line-height:1.7; color:#374151;"

  // Signature block: "Designation · EMP-01 · Department" (only what exists).
  const sigParts = [designation, employeeNo, department].filter(Boolean) as string[]

  const edited = bodyText?.trim() || ""
  // The employee's edited letter -> escaped HTML paragraphs (blank line = new
  // paragraph, single newline = <br>). Falls back to the auto-composed letter.
  const letterHtml = edited
    ? edited
        .split(/\n{2,}/)
        .map((p) => `<p style="${para}">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
        .join("\n")
    : `
    <p style="margin:0 0 18px; font-size:15px; color:#111827;">Dear ${escapeHtml(approverFirstName)},</p>

    <p style="${para}">
      I would like to apply for <strong style="color:#111827;">${escapeHtml(type)}</strong> for
      <strong style="color:#111827;">${dayLabel}</strong>, from
      <strong style="color:#111827;">${dates}</strong>.
    </p>

    ${
      reasonHtml
        ? `<p style="${para}">${reasonHtml}</p>`
        : `<p style="${para}">I have submitted this request in ${BRAND_NAME} for your consideration.</p>`
    }

    <p style="${para}">
      I will ensure my responsibilities are handed over before I leave and can be reached if
      anything urgent comes up. Kindly approve the request at your convenience.
    </p>

    <p style="${para}">Thank you for your consideration.</p>

    <p style="margin:24px 0 0; font-size:15px; color:#111827;">Best Regards,</p>`

  const body = `
    ${letterHtml}
    ${renderSignature({
      name: applicantName,
      designation,
      email: applicantEmail,
      phone: applicantPhone,
    })}

    ${
      reviewUrl
        ? `<p style="margin:24px 0 0; padding-top:16px; border-top:1px solid #f0f0f0; font-size:12px; color:#9ca3af;">
             Approve or decline in <a href="${reviewUrl}" style="color:#2563eb;">${BRAND_NAME}</a>. HR is copied on this email.
           </p>`
        : ""
    }`

  const letterText = edited
    ? edited.split("\n")
    : [
        `Dear ${approverFirstName},`,
        ``,
        `I would like to apply for ${type} for ${dayLabel}, from ${dates}.`,
        ``,
        reasonTrimmed || `I have submitted this request in ${BRAND_NAME} for your consideration.`,
        ``,
        `I will ensure my responsibilities are handed over before I leave and can be reached if anything urgent comes up. Kindly approve the request at your convenience.`,
        ``,
        `Thank you for your consideration.`,
        ``,
        `Best Regards,`,
      ]

  const text = [
    ...letterText,
    applicantName,
    sigParts.join(" · "),
    reviewUrl
      ? `
Approve or decline in ${BRAND_NAME}: ${reviewUrl}`
      : "",
  ]
    .filter((l) => l !== undefined)
    .join("\n")

  return { subject, html: wrapEmail({ title: subject, bodyHtml: body }), text }
}
