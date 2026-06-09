// =============================================================================
// Password-reset OTP email - company-branded, email-client-safe HTML.
// =============================================================================
// Uses table-based layout + inline styles (the only thing Outlook/Gmail render
// reliably). The logo sits on a dark header bar, so we use the white "dark
// background" logo variant. Point EMAIL_LOGO_URL at a hosted PNG for the widest
// client support - many clients (notably Outlook) do NOT render .webp.
// =============================================================================

interface OtpEmailInput {
  firstName: string
  otp: string
}

const BRAND_NAME = "Digitally Next"

function logoUrl(): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")
  return process.env.EMAIL_LOGO_URL ?? `${base}/logo_dark_bg.webp`
}

export function renderPasswordResetOtpEmail({ firstName, otp }: OtpEmailInput): {
  subject: string
  html: string
  text: string
} {
  const subject = "Your DNMS password reset code"

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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header / logo -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#171717 0%,#0a0a0a 100%); padding:32px 32px 28px;">
              <img src="${logoUrl()}" alt="${BRAND_NAME}" height="34" style="height:34px; width:auto; display:block; border:0;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 8px;">
              <h1 style="margin:0 0 14px; font-size:20px; font-weight:600; color:#111827;">Password reset code</h1>
              <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#4b5563;">Hi ${firstName},</p>
              <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#4b5563;">
                Use the verification code below to reset your DNMS password. It expires in
                <strong style="color:#111827;">10 minutes</strong>.
              </p>

              <!-- OTP box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background:#f4f4f5; border:1px solid #e4e4e7; border-radius:10px; padding:20px 0;">
                    <span style="font-size:34px; font-weight:700; letter-spacing:12px; color:#111827; padding-left:12px;">${otp}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0; font-size:13px; line-height:1.6; color:#6b7280;">
                If you didn't request a password reset, you can safely ignore this email - your
                password will stay the same.
              </p>
            </td>
          </tr>

          <!-- Security strip -->
          <tr>
            <td style="padding:20px 36px 32px;">
              <div style="border-top:1px solid #f0f0f0; padding-top:18px;">
                <p style="margin:0; font-size:12px; line-height:1.6; color:#9ca3af;">
                  For your security, never share this code with anyone - including ${BRAND_NAME} staff.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
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

  const text = `Hi ${firstName},

Your DNMS password reset code is: ${otp}

This code expires in 10 minutes. If you didn't request a reset, ignore this email.

For your security, never share this code with anyone.
- ${BRAND_NAME}`

  return { subject, html, text }
}
