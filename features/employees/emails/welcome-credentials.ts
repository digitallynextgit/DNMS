// =============================================================================
// Welcome + credentials email - single branded message sent when an employee is
// created. Replaces the old two-email flow (welcome template + plain credentials)
// with one company-branded, email-client-safe HTML message.
// =============================================================================
// Table-based layout + inline styles (the only thing Outlook/Gmail render
// reliably). The shared `wrapEmail` provides the dark logo header + footer; point
// EMAIL_LOGO_URL at a hosted PNG/WEBP.
// =============================================================================

import { BRAND_NAME, detailRow, wrapEmail } from "@/lib/email-layout"

interface WelcomeCredentialsInput {
  firstName: string
  lastName?: string | null
  email: string
  employeeNo: string
  department?: string | null
  designation?: string | null
  password: string
  mustChange: boolean
  loginUrl: string
}

export function renderWelcomeCredentialsEmail(input: WelcomeCredentialsInput): {
  subject: string
  html: string
  text: string
} {
  const {
    firstName,
    lastName,
    email,
    employeeNo,
    department,
    designation,
    password,
    mustChange,
    loginUrl,
  } = input
  const fullName = `${firstName} ${lastName ?? ""}`.trim()
  const subject = `Welcome to ${BRAND_NAME} - your account is ready`
  const changeNote = mustChange
    ? "For security, you'll be asked to set your own password the first time you sign in."
    : "Please sign in and change your password from your profile."

  const body = `
              <h1 style="margin:0 0 14px; font-size:20px; font-weight:600; color:#111827;">Welcome aboard, ${firstName}!</h1>
              <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#4b5563;">
                Your ${BRAND_NAME} Management System account is ready. Here are your details and sign-in credentials.
              </p>

              <!-- Details card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa; border:1px solid #eeeeee; border-radius:10px; padding:4px 18px;">
                ${detailRow("Full name", fullName)}
                ${detailRow("Employee code", employeeNo)}
                ${detailRow("Department", department)}
                ${detailRow("Designation", designation)}
              </table>

              <!-- Credentials box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px; background:#f4f4f5; border:1px solid #e4e4e7; border-radius:10px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#9ca3af;">Email</div>
                    <div style="font-size:15px; color:#111827; margin:2px 0 14px; word-break:break-all;">${email}</div>
                    <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#9ca3af;">Temporary password</div>
                    <div style="font-size:18px; font-weight:700; color:#111827; margin-top:2px; font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace; letter-spacing:1px;">${password}</div>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 24px; font-size:14px; line-height:1.6; color:#4b5563;">${changeNote}</p>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="border-radius:8px; background:#2563eb;">
                    <a href="${loginUrl}" style="display:inline-block; padding:13px 28px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Log in to DNMS Portal</a>
                  </td>
                </tr>
              </table>

              <p style="margin:22px 0 0; font-size:12px; line-height:1.6; color:#9ca3af; text-align:center;">
                Button not working? Copy and paste this link into your browser:<br />
                <a href="${loginUrl}" style="color:#6b7280;">${loginUrl}</a>
              </p>`

  const html = wrapEmail({ title: subject, bodyHtml: body })

  const text = `Welcome aboard, ${firstName}!

Your ${BRAND_NAME} Management System account is ready.

Full name: ${fullName}
Employee code: ${employeeNo}${department ? `\nDepartment: ${department}` : ""}${designation ? `\nDesignation: ${designation}` : ""}

Email: ${email}
Temporary password: ${password}

${changeNote}
Sign in at ${loginUrl}

- ${BRAND_NAME} HR`

  return { subject, html, text }
}
