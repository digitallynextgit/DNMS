import { wrapEmail } from "@/lib/email-layout"

/**
 * A monitoring alert as an email.
 *
 * In-app notifications only land if someone has DNMS open. The 14 Aug outage
 * started at midnight - nobody was in the app, and nobody would have been. Email
 * is what reaches a phone at 00:05, so every alert goes out on both channels.
 */
export function renderAlertEmail(input: {
  title: string
  message: string
  /** "Site down", "Domain expiring" - drives the colour and the subject prefix. */
  severity: "critical" | "warning" | "info"
  /** Which rung of the ladder this is, so the subject says so. */
  escalationNote?: string
  actionUrl?: string
  actionLabel?: string
}): { subject: string; html: string; text: string } {
  const { title, message, severity, escalationNote, actionUrl, actionLabel } = input

  const accent =
    severity === "critical" ? "#dc2626" : severity === "warning" ? "#d97706" : "#2563eb"
  const prefix = severity === "critical" ? "[ACTION NEEDED] " : ""
  const subject = `${prefix}${title}`

  const body = `
    <h1 style="margin:0 0 14px; font-size:20px; font-weight:600; color:${accent};">${title}</h1>
    <p style="margin:0 0 18px; font-size:15px; line-height:1.6; color:#4b5563;">${message}</p>
    ${
      escalationNote
        ? `<p style="margin:0 0 18px; padding:10px 12px; background:#fef3c7; border-left:3px solid ${accent}; font-size:13px; line-height:1.5; color:#92400e;">${escalationNote}</p>`
        : ""
    }
    ${
      actionUrl
        ? `<p style="margin:0 0 22px;">
             <a href="${actionUrl}" style="display:inline-block; padding:11px 20px; background:#111827; color:#ffffff; font-size:14px; font-weight:500; text-decoration:none; border-radius:6px;">${actionLabel ?? "Open DNMS"}</a>
           </p>`
        : ""
    }
    <p style="margin:0; font-size:13px; line-height:1.6; color:#6b7280;">
      You're getting this because you're on the project team, are its Account Manager, or the alert
      went unacknowledged long enough to escalate.
    </p>`

  const text = [
    title,
    "",
    message,
    ...(escalationNote ? ["", escalationNote] : []),
    ...(actionUrl ? ["", actionUrl] : []),
  ].join("\n")

  return { subject, html: wrapEmail({ title: subject, bodyHtml: body }), text }
}
