// Shared branded email layout. Table-based with inline styles: Gmail/Outlook strip <style> blocks.

import { getConfigSync } from "@/server/app-config"
import { cleanLeaveTypeForLetter } from "@/lib/utils"

export const BRAND_NAME = "Digitally Next"

/** Header wordmark as a small PNG: Outlook desktop can't decode WebP. */
export function logoUrl(): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")
  return getConfigSync("EMAIL_LOGO_URL") || `${base}/email-logo.png`
}

/** Brand mark at 2x its 52px render - mail clients have no image optimizer. */
export function signatureLogoUrl(): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")
  return `${base}/brand-mark-104.png`
}

/** PNG icons, because mail clients strip inline SVG. */
export function signatureIconUrl(name: string): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")
  return `${base}/email-icons/${name}.png`
}

/** Empty values render nothing. */
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

/** Sent from the employee's own mailbox so the manager can be CC'd and reply. */
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

/** Use a "Re: Resignation - <name>" subject so it threads. */
export function renderResignationDecisionEmail(input: {
  approved: boolean
  employeeName: string
  firstName: string
  /** "yyyy-MM-dd" - the confirmed last working day (approvals). */
  lastWorkingDate?: string | null
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

/** `kind` is the request label, e.g. "Leave request". */
export function renderDecisionEmail(input: {
  kind: string
  approved: boolean
  firstName: string
  /** e.g. "Annual Leave · 12 Jun - 14 Jun" */
  detailLine?: string
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

/** Email for a project requirement. The deadline turns red once it's past. */
export function renderRequirementEmail(input: {
  recipientFirstName: string
  raisedByName: string
  projectName: string
  teamName?: string | null
  type: string
  title: string
  details?: string | null
  /** "yyyy-MM-dd" */
  neededBy?: string | null
  blockedTaskCount?: number
  overdue?: boolean
  url?: string
}): { subject: string; html: string; text: string } {
  const {
    recipientFirstName,
    raisedByName,
    projectName,
    teamName,
    type,
    title,
    details,
    neededBy,
    blockedTaskCount = 0,
    overdue = false,
    url,
  } = input

  const subject = overdue
    ? `Overdue requirement: ${title} - ${projectName}`
    : `Requirement: ${title} - ${projectName}`
  const by = formatEmailDate(neededBy)
  const para = "margin:0 0 16px; font-size:15px; line-height:1.7; color:#374151;"
  const who = teamName ? `the ${escapeHtml(teamName)} team` : "a team"

  const body = `
    <h1 style="margin:0 0 14px; font-size:20px; font-weight:600; color:${overdue ? "#dc2626" : "#111827"};">
      ${overdue ? "Requirement overdue" : "A team is waiting on you"}
    </h1>

    <p style="margin:0 0 18px; font-size:15px; color:#111827;">Hi ${escapeHtml(recipientFirstName)},</p>

    <p style="${para}">
      <strong style="color:#111827;">${escapeHtml(raisedByName)}</strong> has raised a requirement on
      <strong style="color:#111827;">${escapeHtml(projectName)}</strong>. Until it is provided,
      ${who} cannot carry on with this work.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      ${detailRow("What is needed", escapeHtml(title))}
      ${detailRow("Type", escapeHtml(type))}
      ${detailRow("Project", escapeHtml(projectName))}
      ${teamName ? detailRow("Blocked team", escapeHtml(teamName)) : ""}
      ${detailRow("Raised by", escapeHtml(raisedByName))}
      ${
        by
          ? `<tr><td style="padding:10px 0; border-bottom:1px solid #f0f0f0;">
               <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#9ca3af;">Needed by</div>
               <div style="font-size:15px; margin-top:2px; color:${overdue ? "#dc2626" : "#111827"};">
                 ${by}${overdue ? " &middot; overdue" : ""}
               </div>
             </td></tr>`
          : ""
      }
      ${blockedTaskCount > 0 ? detailRow("Tasks blocked", String(blockedTaskCount)) : ""}
    </table>

    ${
      details
        ? `<div style="margin:0 0 20px; padding:14px 16px; background:#f9fafb; border-left:3px solid #d4d4d8; border-radius:3px;">
             <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#9ca3af; margin-bottom:6px;">Details</div>
             <div style="font-size:14px; line-height:1.7; color:#374151;">${escapeHtml(details).replace(/\n/g, "<br />")}</div>
           </div>`
        : ""
    }

    ${
      url
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
             <tr><td style="border-radius:4px; background:#171717;">
               <a href="${url}" style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">
                 Open in ${BRAND_NAME}
               </a>
             </td></tr>
           </table>`
        : ""
    }`

  const text = [
    overdue ? "Requirement overdue" : "A team is waiting on you",
    "",
    `Hi ${recipientFirstName},`,
    "",
    `${raisedByName} has raised a requirement on ${projectName}.`,
    "",
    `What is needed: ${title}`,
    `Type: ${type}`,
    teamName ? `Blocked team: ${teamName}` : "",
    by ? `Needed by: ${by}${overdue ? " (overdue)" : ""}` : "",
    blockedTaskCount > 0 ? `Tasks blocked: ${blockedTaskCount}` : "",
    details ? `\nDetails:\n${details}` : "",
    url ? `\n${url}` : "",
    "",
    `- ${BRAND_NAME}`,
  ]
    .filter(Boolean)
    .join("\n")

  return { subject, html: wrapEmail({ title: subject, bodyHtml: body }), text }
}

/** "You're now the owner of …": a project service (and its calendar), or one calendar. */
export function renderOwnerAssignedEmail(input: {
  recipientFirstName: string
  assignedByName: string
  projectName: string
  /** Set for a service: "Social Media". */
  serviceName?: string | null
  /** The calendar they now run, e.g. "Social Media Calendar". */
  calendarName?: string | null
  url?: string
}): { subject: string; html: string; text: string } {
  const { recipientFirstName, assignedByName, projectName, serviceName, calendarName, url } = input
  const what = serviceName ?? calendarName ?? "a calendar"
  const subject = `You're the owner of ${what} - ${projectName}`
  const para = "margin:0 0 16px; font-size:15px; line-height:1.7; color:#374151;"
  const duty = serviceName
    ? "You answer for this service on the project and run its calendar each month: planning it, keeping it filled in and seeing the work through."
    : "You answer for this calendar: planning it, keeping it filled in and seeing the work through."

  const body = `
    <h1 style="margin:0 0 14px; font-size:20px; font-weight:600; color:#111827;">You have a new responsibility</h1>

    <p style="margin:0 0 18px; font-size:15px; color:#111827;">Hi ${escapeHtml(recipientFirstName)},</p>

    <p style="${para}">
      <strong style="color:#111827;">${escapeHtml(assignedByName)}</strong> has made you the owner of
      <strong style="color:#111827;">${escapeHtml(what)}</strong> on
      <strong style="color:#111827;">${escapeHtml(projectName)}</strong>.
    </p>

    <p style="${para}">${duty}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      ${detailRow("Project", escapeHtml(projectName))}
      ${serviceName ? detailRow("Service", escapeHtml(serviceName)) : ""}
      ${calendarName ? detailRow("Calendar", escapeHtml(calendarName)) : ""}
      ${detailRow("Assigned by", escapeHtml(assignedByName))}
    </table>

    ${
      url
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
             <tr><td style="border-radius:4px; background:#171717;">
               <a href="${url}" style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">
                 Open in ${BRAND_NAME}
               </a>
             </td></tr>
           </table>`
        : ""
    }`

  const text = [
    "You have a new responsibility",
    "",
    `Hi ${recipientFirstName},`,
    "",
    `${assignedByName} has made you the owner of ${what} on ${projectName}.`,
    duty,
    "",
    `Project: ${projectName}`,
    serviceName ? `Service: ${serviceName}` : "",
    calendarName ? `Calendar: ${calendarName}` : "",
    url ? `\n${url}` : "",
    "",
    `- ${BRAND_NAME}`,
  ]
    .filter(Boolean)
    .join("\n")

  return { subject, html: wrapEmail({ title: subject, bodyHtml: body }), text }
}

/** Mirrors the staff Gmail signature. Company bits come from app settings; blank socials are omitted. */
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

  const RED = "#e5231b"
  const TEAL = "#25c1c1"
  const INK = "#1a1a1a"
  const BODY = "#374151"

  const body = `font-size:12px; color:${BODY};`
  const link = `color:${BODY}; text-decoration:none;`
  const websiteHref = website.startsWith("http") ? website : `https://${website}`

  void TEAL // baked into the icon PNGs

  const iconMap: Record<string, string> = {
    YouTube: "youtube",
    Instagram: "instagram",
    LinkedIn: "linkedin",
  }
  const order = ["YouTube", "Instagram", "LinkedIn"]
  const socialIcons = order
    .map((label) => socials.find((s) => s.label.toLowerCase() === label.toLowerCase()))
    .filter((s): s is { label: string; url: string } => Boolean(s?.url))
    .map(
      (s) =>
        `<a href="${s.url}" style="display:inline-block; margin-left:6px; text-decoration:none;"><img src="${signatureIconUrl(iconMap[s.label]!)}" alt="${escapeHtml(s.label)}" width="20" height="20" style="display:inline-block; border:0;" /></a>`,
    )
    .join("")

  const iconText = (icon: string, inner: string) =>
    `<span style="white-space:nowrap;"><img src="${signatureIconUrl(icon)}" width="13" height="13" alt="" style="border:0; vertical-align:-2px; margin-right:5px;" />${inner}</span>`

  const contactLine = [
    phone ? iconText("phone", `<span style="${body}">${escapeHtml(phone)}</span>`) : "",
    website
      ? iconText("globe", `<a href="${websiteHref}" style="${link}">${escapeHtml(website)}</a>`)
      : "",
  ]
    .filter(Boolean)
    .join(`<span>&nbsp;&nbsp;&nbsp;&nbsp;</span>`)

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
              ${socialIcons ? `<td align="right" style="vertical-align:top; white-space:nowrap;">${socialIcons}</td>` : ""}
            </tr>
          </table>
          <div style="border-top:1.5px solid ${RED}; margin:10px 0;"></div>
          ${contactLine ? `<div style="margin:0 0 5px;">${contactLine}</div>` : ""}
          ${email ? `<div style="margin:0 0 5px;">${iconText("mail", `<a href="mailto:${escapeHtml(email)}" style="${link}">${escapeHtml(email)}</a>`)}</div>` : ""}
          ${address ? `<div style="margin:0 0 2px;">${iconText("pin", `<span style="${body}">${escapeHtml(address)}</span>`)}</div>` : ""}
          <div style="border-top:1.5px solid ${RED}; margin-top:12px;"></div>
        </td>
      </tr>
    </table>`
}

/** Written as the employee to their manager (HR CC'd), so it reads like a letter, not an alert. */
export function renderLeaveRequestEmail(input: {
  approverFirstName: string
  applicantName: string
  employeeNo?: string | null
  designation?: string | null
  department?: string | null
  applicantEmail?: string | null
  applicantPhone?: string | null
  leaveType: string
  /** "yyyy-MM-dd" */
  startDate: string
  endDate: string
  totalDays: number
  reason?: string | null
  /** Replaces the auto letter body (greeting to "Best Regards,"); the signature and link are still added. */
  bodyText?: string | null
  /** Replaces the auto subject (edited in the preview). */
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
  const type = cleanLeaveTypeForLetter(leaveType)
  const subject = subjectText?.trim() || `Leave application - ${applicantName} - ${dates}`

  const reasonTrimmed = reason?.trim() || ""
  const reasonHtml = reasonTrimmed ? escapeHtml(reasonTrimmed).replace(/\n/g, "<br />") : ""
  const para = "margin:0 0 16px; font-size:15px; line-height:1.7; color:#374151;"

  // "Designation · EMP-01 · Department" (only what exists)
  const sigParts = [designation, employeeNo, department].filter(Boolean) as string[]

  const edited = bodyText?.trim() || ""
  // Blank line = new paragraph, single newline = <br>.
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

/**
 * Written as the approver to the employee, threaded onto the original application.
 * `bodyText` (the approver's edit) replaces the auto letter.
 */
export function renderLeaveDecisionLetter(input: {
  employeeFirstName: string
  approved: boolean
  leaveType: string
  /** "yyyy-MM-dd" */
  startDate: string
  endDate: string
  totalDays: number
  reason?: string | null
  bodyText?: string | null
  /** The service passes "Re: <original>". */
  subject: string
  approverName: string
  approverDesignation?: string | null
  approverEmail?: string | null
  approverPhone?: string | null
}): { subject: string; html: string; text: string } {
  const {
    employeeFirstName,
    approved,
    leaveType,
    startDate,
    endDate,
    totalDays,
    reason,
    bodyText,
    subject,
    approverName,
    approverDesignation,
    approverEmail,
    approverPhone,
  } = input

  const start = formatEmailDate(startDate) ?? startDate
  const end = formatEmailDate(endDate) ?? endDate
  const dates = start === end ? start : `${start} to ${end}`
  const dayLabel = `${totalDays} day${totalDays === 1 ? "" : "s"}`
  const type = cleanLeaveTypeForLetter(leaveType)
  const para = "margin:0 0 16px; font-size:15px; line-height:1.7; color:#374151;"
  const reasonTrimmed = reason?.trim() || ""

  // Keep in sync with the client-side composer in the approve/reject dialog.
  const defaultLines = approved
    ? [
        `Dear ${employeeFirstName},`,
        ``,
        `I am pleased to inform you that your application for ${type} for ${dayLabel}, from ${dates}, has been approved.`,
        ``,
        `Please ensure your responsibilities are handed over before you go. Do reach out if anything needs to be sorted beforehand.`,
        ``,
        `Best Regards,`,
      ]
    : [
        `Dear ${employeeFirstName},`,
        ``,
        `Thank you for your application for ${type} for ${dayLabel}, from ${dates}. After review, I am unable to approve it at this time.`,
        ``,
        ...(reasonTrimmed ? [`Reason: ${reasonTrimmed}`, ``] : []),
        `Please feel free to reach out if you would like to discuss this further.`,
        ``,
        `Best Regards,`,
      ]

  const edited = bodyText?.trim() || ""
  const paras = (edited ? edited.split(/\n{2,}/) : defaultLines.join("\n").split(/\n{2,}/)).map(
    (p) => `<p style="${para}">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`,
  )

  const body = `
    ${paras.join("\n")}
    ${renderSignature({
      name: approverName,
      designation: approverDesignation,
      email: approverEmail,
      phone: approverPhone,
    })}`

  const text = (edited ? edited.split("\n") : defaultLines)
    .concat([
      approverName,
      approverDesignation ? `${approverDesignation}, ${BRAND_NAME}` : BRAND_NAME,
    ])
    .join("\n")

  return { subject, html: wrapEmail({ title: subject, bodyHtml: body }), text }
}

/** The WFH twin of renderLeaveRequestEmail, so both read alike in a manager's inbox. */
export function renderWfhRequestEmail(input: {
  approverFirstName: string
  applicantName: string
  employeeNo?: string | null
  designation?: string | null
  department?: string | null
  applicantEmail?: string | null
  applicantPhone?: string | null
  /** "yyyy-MM-dd", the first day. */
  date: string
  /** "yyyy-MM-dd". Omitted or equal to `date` means a single day. */
  endDate?: string | null
  /** Working days only (weekends/holidays skipped). */
  totalDays?: number | null
  reason?: string | null
  /** Emergency requests need BOTH the manager and HR to sign off. */
  isEmergency?: boolean
  bodyText?: string | null
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
    date,
    endDate,
    totalDays,
    reason,
    isEmergency,
    bodyText,
    subjectText,
    reviewUrl,
  } = input

  const day = formatEmailDate(date) ?? date
  const lastDay = endDate && endDate !== date ? (formatEmailDate(endDate) ?? endDate) : null

  // Built once so the subject, HTML and plain-text letters always agree.
  const dayLabel = lastDay ? `${day} to ${lastDay}` : day
  const daysNote = lastDay && totalDays && totalDays > 1 ? ` (${totalDays} working days)` : ""
  const whenPhrase = lastDay ? `from ${dayLabel}${daysNote}` : `on ${dayLabel}`

  const subject = subjectText?.trim() || `Work From Home request - ${applicantName} - ${dayLabel}`

  const reasonTrimmed = reason?.trim() || ""
  const reasonHtml = reasonTrimmed ? escapeHtml(reasonTrimmed).replace(/\n/g, "<br />") : ""
  const para = "margin:0 0 16px; font-size:15px; line-height:1.7; color:#374151;"

  const sigParts = [designation, employeeNo, department].filter(Boolean) as string[]

  const availabilityLine = lastDay
    ? "I will be available online through working hours on each of these days, reachable on call and chat, and will keep my deliverables on track."
    : "I will be available online through working hours, reachable on call and chat, and will keep the day's deliverables on track."
  const emergencyLine =
    "As this is an emergency request, it needs both your approval and HR's sign-off."

  const edited = bodyText?.trim() || ""
  const letterHtml = edited
    ? edited
        .split(/\n{2,}/)
        .map((p) => `<p style="${para}">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
        .join("\n")
    : `
    <p style="margin:0 0 18px; font-size:15px; color:#111827;">Dear ${escapeHtml(approverFirstName)},</p>

    <p style="${para}">
      I would like to request permission to <strong style="color:#111827;">work from home</strong> ${lastDay ? "from" : "on"}
      <strong style="color:#111827;">${dayLabel}</strong>${escapeHtml(daysNote)}.
    </p>

    ${
      reasonHtml
        ? `<p style="${para}">${reasonHtml}</p>`
        : `<p style="${para}">I have submitted this request in ${BRAND_NAME} for your consideration.</p>`
    }

    ${isEmergency ? `<p style="${para}">${emergencyLine}</p>` : ""}

    <p style="${para}">${availabilityLine} Kindly approve the request at your convenience.</p>

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
        `I would like to request permission to work from home ${whenPhrase}.`,
        ``,
        reasonTrimmed || `I have submitted this request in ${BRAND_NAME} for your consideration.`,
        ...(isEmergency ? [``, emergencyLine] : []),
        ``,
        `${availabilityLine} Kindly approve the request at your convenience.`,
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

/** Same letter shape as leave and WFH; also states the yearly balance. HR makes the final call. */
export function renderFloatingHolidayRequestEmail(input: {
  approverFirstName: string
  applicantName: string
  employeeNo?: string | null
  designation?: string | null
  department?: string | null
  applicantEmail?: string | null
  applicantPhone?: string | null
  /** e.g. "Diwali" */
  holidayName: string
  /** "yyyy-MM-dd" - always a single day. */
  date: string
  reason?: string | null
  /** This is the Nth of `limit` for `year`. */
  usedCount: number
  limit: number
  year: number
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
    holidayName,
    date,
    reason,
    usedCount,
    limit,
    year,
    reviewUrl,
  } = input

  const day = formatEmailDate(date) ?? date
  const holiday = escapeHtml(holidayName)
  const subject = `Floating Holiday request - ${applicantName} - ${holidayName}, ${day}`

  const ordinal = (n: number) => {
    const teen = n % 100 >= 11 && n % 100 <= 13
    return `${n}${teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`
  }
  const balanceSentence = `This would be my ${ordinal(usedCount)} floating holiday of ${limit} for ${year}.`

  const reasonTrimmed = reason?.trim() || ""
  const reasonHtml = reasonTrimmed ? escapeHtml(reasonTrimmed).replace(/\n/g, "<br />") : ""
  const para = "margin:0 0 16px; font-size:15px; line-height:1.7; color:#374151;"

  const sigParts = [designation, employeeNo, department].filter(Boolean) as string[]

  const body = `
    <p style="margin:0 0 18px; font-size:15px; color:#111827;">Dear ${escapeHtml(approverFirstName)},</p>

    <p style="${para}">
      I would like to apply for a <strong style="color:#111827;">floating (optional) holiday</strong> on
      <strong style="color:#111827;">${day}</strong> for <strong style="color:#111827;">${holiday}</strong>.
    </p>

    ${reasonHtml ? `<p style="${para}">${reasonHtml}</p>` : ""}

    <p style="${para}">
      ${balanceSentence} I will plan my work around the day so that nothing pending is affected,
      and I will hand over anything time-sensitive before I am away.
    </p>

    <p style="${para}">
      This request goes to you first and is then confirmed by HR. Kindly approve it at your convenience.
    </p>

    <p style="${para}">Thank you for your consideration.</p>

    <p style="margin:24px 0 0; font-size:15px; color:#111827;">Best Regards,</p>
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

  const text = [
    `Dear ${approverFirstName},`,
    ``,
    `I would like to apply for a floating (optional) holiday on ${day} for ${holidayName}.`,
    ...(reasonTrimmed ? [``, reasonTrimmed] : []),
    ``,
    `${balanceSentence} I will plan my work around the day so that nothing pending is affected, and I will hand over anything time-sensitive before I am away.`,
    ``,
    `This request goes to you first and is then confirmed by HR. Kindly approve it at your convenience.`,
    ``,
    `Thank you for your consideration.`,
    ``,
    `Best Regards,`,
    applicantName,
    sigParts.join(" · "),
    ...(reviewUrl ? [``, `Approve or decline in ${BRAND_NAME}: ${reviewUrl}`] : []),
  ].join("\n")

  return { subject, html: wrapEmail({ title: subject, bodyHtml: body }), text }
}
