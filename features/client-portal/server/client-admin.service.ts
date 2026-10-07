// =============================================================================
// Portal credentials (staff side)
// =============================================================================
// The password helpers behind Clients → Contacts (client-contacts.service.ts).
// Portal access is managed only from the client's page; projects no longer have
// a Portal access tab of their own.
// =============================================================================

import "server-only"

import { randomBytes } from "node:crypto"
import { addEmailJob } from "@/lib/queue"
import { getConfig } from "@/server/app-config"
import { renderClientInviteEmail } from "../emails/client-invite"

/**
 * A temporary password, emailed to the client. 18 base64url chars ≈ 108 bits -
 * not guessable, and never returned to the caller, so it cannot surface in an
 * API response, a log line or the browser devtools.
 */
export function generatePassword(): string {
  return randomBytes(14).toString("base64url").slice(0, 18)
}

export async function sendCredentials(input: {
  to: string
  name: string
  password: string
  projectName: string
  isReset: boolean
  mustChange: boolean
}): Promise<void> {
  const appUrl = (await getConfig("APP_URL")) ?? process.env.NEXTAUTH_URL ?? ""
  const email = renderClientInviteEmail({
    name: input.name,
    email: input.to,
    tempPassword: input.password,
    isReset: input.isReset,
    mustChange: input.mustChange,
    projectName: input.projectName,
    loginUrl: appUrl ? `${appUrl.replace(/\/$/, "")}/login` : "/login",
  })
  addEmailJob({
    to: input.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    profile: "notifications",
  })
}
