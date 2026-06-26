import nodemailer from "nodemailer"
import type { EmailTemplate } from "@prisma/client"
import { db } from "@/server/db"
import { tryDecrypt } from "@/lib/crypto"
import { getConfig } from "@/server/app-config"

// ---------------------------------------------------------------------------
// Mailer profiles
// ---------------------------------------------------------------------------
// Different use-cases can send from different mailboxes. Each named profile
// reads SMTP_<PROFILE>_* env vars and falls back to the base SMTP_* vars for
// anything it doesn't override - so to send notifications from a different
// address on the SAME SMTP account you only need to set SMTP_NOTIFICATIONS_FROM.
//
//   default       → SMTP_*                    (e.g. noreply@digitallynext.com)
//   notifications → SMTP_NOTIFICATIONS_*      (notification@digitallynext.com)
//   hr            → SMTP_HR_*                  (hr@digitallynext.com)
//
// Add more by simply using a new profile name + matching SMTP_<NAME>_* vars.
// ---------------------------------------------------------------------------
export type MailerProfile = "default" | "notifications" | "hr" | (string & {})

// Resolve a config value for a profile via app-config (DB settings → env),
// falling back to the base SMTP_* key. e.g. profile "hr" key "HOST" tries
// SMTP_HR_HOST then SMTP_HOST.
async function profileConfig(profile: string, key: string): Promise<string | undefined> {
  if (profile !== "default") {
    const scoped = await getConfig(`SMTP_${profile.toUpperCase()}_${key}`)
    if (scoped) return scoped
  }
  return getConfig(`SMTP_${key}`)
}

// Build a fresh transporter from the current config (no caching, so admin edits
// to SMTP settings on the Integrations page take effect immediately).
async function buildProfile(profile: string) {
  const user = await profileConfig(profile, "USER")
  const transporter = nodemailer.createTransport({
    host: (await profileConfig(profile, "HOST")) || "smtp.gmail.com",
    port: parseInt((await profileConfig(profile, "PORT")) || "587", 10),
    secure: (await profileConfig(profile, "SECURE")) === "true",
    auth: user ? { user, pass: await profileConfig(profile, "PASS") } : undefined,
  })
  const from = (await profileConfig(profile, "FROM")) || "DNMS <noreply@digitallynext.com>"
  return { transporter, from }
}

interface SendEmailOptions {
  to: string | string[]
  cc?: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>
  replyTo?: string
  // Threading headers: set both to a prior message's Message-ID so this email
  // replies on the same email thread (Gmail conversation).
  inReplyTo?: string
  references?: string | string[]
  // Which configured mailbox to send from (default: "default").
  profile?: MailerProfile
  // Explicit From override; wins over the profile's configured From.
  from?: string
}

// Normalize an address (or list) into the comma-joined string nodemailer wants,
// or undefined when there are no addresses.
function addressList(value?: string | string[]): string | undefined {
  if (!value) return undefined
  const joined = Array.isArray(value) ? value.filter(Boolean).join(", ") : value
  return joined || undefined
}

export async function sendEmail(options: SendEmailOptions): Promise<string | null> {
  const { transporter, from } = await buildProfile(options.profile ?? "default")
  try {
    const info = await transporter.sendMail({
      from: options.from ?? from,
      to: addressList(options.to),
      cc: addressList(options.cc),
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
      replyTo: options.replyTo,
      inReplyTo: options.inReplyTo,
      references: options.references,
    })
    return info.messageId ?? null
  } finally {
    transporter.close()
  }
}

/**
 * Sends an email impersonating the given employee, using their stored Gmail App Password.
 * Falls back to the system mailer (sendEmail) if the employee has no App Password set.
 *
 * Use for emails that should appear to come from a specific person - e.g. a manager
 * approving a leave, a recruiter sending a stage-change message. System-level mail
 * (password resets, birthdays) should keep using sendEmail.
 */
export async function sendEmailAs(
  employeeId: string,
  options: SendEmailOptions,
): Promise<string | null> {
  const emp = await db.employee.findUnique({
    where: { id: employeeId },
    select: { email: true, firstName: true, lastName: true, gmailAppPassword: true },
  })

  // No employee or no App Password on file → fall back to the shared system mailer.
  if (!emp?.gmailAppPassword) {
    return sendEmail(options)
  }

  const password = tryDecrypt(emp.gmailAppPassword)
  if (!password) {
    console.error(
      "[sendEmailAs] Failed to decrypt App Password for",
      employeeId,
      "- falling back to system mailer",
    )
    return sendEmail(options)
  }

  // Build a one-off transporter for this employee, send, discard.
  const perUser = nodemailer.createTransport({
    host: (await getConfig("SMTP_HOST")) || "smtp.gmail.com",
    port: parseInt((await getConfig("SMTP_PORT")) || "587", 10),
    secure: (await getConfig("SMTP_SECURE")) === "true",
    auth: { user: emp.email, pass: password },
  })

  const fromName = `${emp.firstName} ${emp.lastName}`.trim() || emp.email

  try {
    const info = await perUser.sendMail({
      from: `"${fromName}" <${emp.email}>`,
      to: addressList(options.to),
      cc: addressList(options.cc),
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
      replyTo: options.replyTo,
      inReplyTo: options.inReplyTo,
      references: options.references,
    })
    return info.messageId ?? null
  } finally {
    perUser.close()
  }
}

export function renderTemplate(
  template: Pick<EmailTemplate, "subject" | "bodyHtml">,
  data: Record<string, string>,
): { subject: string; html: string } {
  let subject = template.subject
  let html = template.bodyHtml

  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g")
    subject = subject.replace(regex, value)
    html = html.replace(regex, value)
  }

  return { subject, html }
}
