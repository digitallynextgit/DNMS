// Portal password helpers for Clients -> Contacts.

import "server-only"

import { randomBytes } from "node:crypto"
import { addEmailJob } from "@/lib/queue"
import { getConfig } from "@/server/app-config"
import { renderClientInviteEmail } from "../emails/client-invite"

/** Temporary password (~108 bits), emailed to the client and never returned to the caller. */
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
