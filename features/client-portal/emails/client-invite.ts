import { wrapEmail } from "@/lib/email-layout"

/**
 * The only email a client account ever gets from provisioning: their address,
 * a temporary password, and where to sign in. The password is shown once here
 * and forced to change on first sign-in, so it is never stored in readable form
 * anywhere and never returned by an API.
 */
export function renderClientInviteEmail(input: {
  name: string
  email: string
  tempPassword: string
  /** true when an admin re-issued the password rather than creating the account. */
  isReset: boolean
  /** Whether they'll be forced to replace this password on first sign-in. The
   *  wording has to match reality, or they go looking for a prompt that never
   *  appears (or are surprised by one that does). */
  mustChange: boolean
  /** The project they were added to, so a client on several knows which. */
  projectName?: string
  loginUrl: string
}): { subject: string; html: string; text: string } {
  const { name, email, tempPassword, isReset, mustChange, projectName, loginUrl } = input
  const subject = isReset
    ? "Your client portal password has been reset"
    : "Your client portal access is ready"

  const opening = isReset
    ? "Your password has been reset."
    : `An account has been created for you on the ${projectName ? `${projectName} ` : ""}client portal.`
  const closing = mustChange
    ? "Use the temporary password below to sign in - you'll be asked to choose your own straight away."
    : "Use the password below to sign in. You can change it at any time from the portal."
  const intro = `${opening} ${closing}`
  const passwordLabel = mustChange ? "Temporary password" : "Password"

  const body = `
    <h1 style="margin:0 0 14px; font-size:20px; font-weight:600; color:#111827;">${subject}</h1>
    <p style="margin:0 0 18px; font-size:15px; line-height:1.6; color:#4b5563;">
      Hi ${name}, ${intro}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px; width:100%; border:1px solid #e5e7eb; border-radius:6px;">
      <tr>
        <td style="padding:12px 14px; font-size:13px; color:#6b7280; border-bottom:1px solid #e5e7eb;">Email</td>
        <td style="padding:12px 14px; font-size:14px; color:#111827; border-bottom:1px solid #e5e7eb;"><strong>${email}</strong></td>
      </tr>
      <tr>
        <td style="padding:12px 14px; font-size:13px; color:#6b7280;">${passwordLabel}</td>
        <td style="padding:12px 14px; font-size:14px; color:#111827;">
          <code style="font-family:ui-monospace,Menlo,Consolas,monospace; font-size:15px; letter-spacing:0.5px;">${tempPassword}</code>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 22px;">
      <a href="${loginUrl}" style="display:inline-block; padding:11px 20px; background:#111827; color:#ffffff; font-size:14px; font-weight:500; text-decoration:none; border-radius:6px;">Sign in to the portal</a>
    </p>
    <p style="margin:0; font-size:13px; line-height:1.6; color:#6b7280;">
      For your security, don't forward this email. If you didn't expect it, please tell your account manager.
    </p>`

  const text = [
    `Hi ${name},`,
    "",
    intro,
    "",
    `Email: ${email}`,
    `${passwordLabel}: ${tempPassword}`,
    "",
    `Sign in: ${loginUrl}`,
    "",
    "For your security, don't forward this email.",
  ].join("\n")

  return { subject, html: wrapEmail({ title: subject, bodyHtml: body }), text }
}
