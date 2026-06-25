// =============================================================================
// Shared branded email layout. Centralizes the brand name, logo header and
// footer that were duplicated across the welcome, password-reset and inline
// approve/reject emails. Table-based + inline styles for email-client safety.
// =============================================================================

export const BRAND_NAME = "Digitally Next"

export function logoUrl(): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")
  return process.env.EMAIL_LOGO_URL ?? `${base}/logo_dark_bg.webp`
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
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
              <p style="margin:0; font-size:12px; color:#9ca3af;">
                This is an automated message from ${BRAND_NAME} Management System.
              </p>
              <p style="margin:6px 0 0; font-size:12px; color:#c4c4c8;">
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
