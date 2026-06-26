// =============================================================================
// Shared branded email layout. Centralizes the brand name, logo header and
// footer that were duplicated across the welcome, password-reset and inline
// approve/reject emails. Table-based + inline styles for email-client safety.
// =============================================================================

import { getConfigSync } from "@/server/app-config"

export const BRAND_NAME = "Digitally Next"

export function logoUrl(): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")
  return getConfigSync("EMAIL_LOGO_URL") || `${base}/logo_dark_bg.webp`
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
