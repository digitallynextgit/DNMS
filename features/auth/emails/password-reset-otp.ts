// =============================================================================
// Password-reset OTP email - company-branded, email-client-safe HTML.
// =============================================================================
// Uses table-based layout + inline styles (the only thing Outlook/Gmail render
// reliably). The shared `wrapEmail` provides the dark logo header + footer; point
// EMAIL_LOGO_URL at a hosted PNG for the widest client support - many clients
// (notably Outlook) do NOT render .webp.
// =============================================================================

import { BRAND_NAME, wrapEmail } from "@/lib/email-layout"

interface OtpEmailInput {
  firstName: string
  otp: string
}

export function renderPasswordResetOtpEmail({ firstName, otp }: OtpEmailInput): {
  subject: string
  html: string
  text: string
} {
  const subject = "Your DNMS password reset code"

  const body = `
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

              <!-- Security strip -->
              <div style="border-top:1px solid #f0f0f0; margin-top:20px; padding-top:18px;">
                <p style="margin:0; font-size:12px; line-height:1.6; color:#9ca3af;">
                  For your security, never share this code with anyone - including ${BRAND_NAME} staff.
                </p>
              </div>`

  const html = wrapEmail({ title: subject, bodyHtml: body })

  const text = `Hi ${firstName},

Your DNMS password reset code is: ${otp}

This code expires in 10 minutes. If you didn't request a reset, ignore this email.

For your security, never share this code with anyone.
- ${BRAND_NAME}`

  return { subject, html, text }
}
