// =============================================================================
// Welcome + credentials email - single branded message sent when an employee is
// created. Replaces the old two-email flow (welcome template + plain credentials)
// with one company-branded, email-client-safe HTML message.
// =============================================================================
// Table-based layout + inline styles (the only thing Outlook/Gmail render
// reliably). Logo sits on a dark header; point EMAIL_LOGO_URL at a hosted PNG/WEBP.
// =============================================================================

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

const BRAND_NAME = "Digitally Next"

function logoUrl(): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")
  return process.env.EMAIL_LOGO_URL ?? `${base}/logo_dark_bg.webp`
}

// A single "Label / value" row in the details card (omitted when value is empty).
function detailRow(label: string, value?: string | null): string {
  if (!value) return ""
  return `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid #f0f0f0;">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#9ca3af;">${label}</div>
        <div style="font-size:15px; color:#111827; margin-top:2px;">${value}</div>
      </td>
    </tr>`
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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header / logo -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#171717 0%,#0a0a0a 100%); padding:32px 32px 28px;">
              <img src="${logoUrl()}" alt="${BRAND_NAME}" height="34" style="height:34px; width:auto; display:block; border:0;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 8px;">
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
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background:#fafafa; border-top:1px solid #f0f0f0; padding:20px 32px; margin-top:24px;">
              <p style="margin:0; font-size:12px; color:#9ca3af;">
                Questions? Reach out to your HR team. This is an automated message from ${BRAND_NAME} Management System.
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
