import nodemailer from "nodemailer"
import type { EmailTemplate } from "@prisma/client"
import { db } from "@/server/db"
import { tryDecrypt } from "@/lib/crypto"
import { getConfig } from "@/server/app-config"

// ---------------------------------------------------------------------------
// Mailer profiles
// ---------------------------------------------------------------------------
// Different use-cases can send from different mailboxes. Each named profile
// reads SMTP_<PROFILE>_* config (DB settings → env), with the base SMTP_* keys
// belonging to the "default" profile:
//
//   default       → SMTP_*                    (e.g. noreply@digitallynext.com)
//   notifications → SMTP_NOTIFICATIONS_*      (REQUIRED - the guaranteed fallback)
//   hr            → SMTP_HR_*                  (hr@digitallynext.com)
//
// The "notifications" profile is mandatory (enforced on the Integrations page)
// and acts as the final fallback for EVERY other profile: when a requested
// profile has no usable credentials of its own, mail is sent through the next
// profile in the chain that does, ending at notifications. Credentials
// (host/user/pass) are always taken as one coherent unit from a single profile
// so we never mix one account's host with another's password.
//
// Add more by simply using a new profile name + matching SMTP_<NAME>_* keys.
// ---------------------------------------------------------------------------
export type MailerProfile = "default" | "notifications" | "hr" | (string & {})

interface ProfileConfig {
  from?: string
  host?: string
  port?: string
  secure?: string
  user?: string
  pass?: string
}

// The config-key prefix for a profile. "default" uses the base SMTP_* keys.
function keyPrefix(profile: string): string {
  return profile === "default" ? "SMTP_" : `SMTP_${profile.toUpperCase()}_`
}

// Read a profile's full SMTP config (DB settings → env) in one shot.
async function readProfile(profile: string): Promise<ProfileConfig> {
  const p = keyPrefix(profile)
  const [from, host, port, secure, user, pass] = await Promise.all([
    getConfig(`${p}FROM`),
    getConfig(`${p}HOST`),
    getConfig(`${p}PORT`),
    getConfig(`${p}SECURE`),
    getConfig(`${p}USER`),
    getConfig(`${p}PASS`),
  ])
  return { from, host, port, secure, user, pass }
}

// A profile can actually authenticate and send only with all three of these.
function hasCredentials(c: ProfileConfig): boolean {
  return Boolean(c.host && c.user && c.pass)
}

// Parse a configured port, falling back to 587 for missing or non-numeric values
// (a stray DB/env value must never produce a NaN port on the transporter).
function toPort(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10)
  return Number.isNaN(n) ? 587 : n
}

// Fallback order, ending at the mandatory "notifications" profile so mail still
// sends when the Default or HR mailer isn't configured.
function fallbackChain(profile: string): string[] {
  if (profile === "notifications") return ["notifications"]
  if (profile === "default") return ["default", "notifications"]
  return [profile, "default", "notifications"] // hr or any custom profile
}

// Build a fresh transporter from the current config (no caching, so admin edits
// to SMTP settings on the Integrations page take effect immediately).
async function buildProfile(profile: string) {
  const requested = await readProfile(profile)

  // Pick the first profile in the chain that has usable credentials; the
  // mandatory notifications profile is the guaranteed tail of every chain.
  let account: ProfileConfig | null = hasCredentials(requested) ? requested : null
  if (!account) {
    for (const candidate of fallbackChain(profile)) {
      if (candidate === profile) continue
      const c = await readProfile(candidate)
      if (hasCredentials(c)) {
        account = c
        break
      }
    }
  }
  // Last resort so we never crash building the transporter.
  if (!account) account = await readProfile("notifications")

  const transporter = nodemailer.createTransport({
    host: account.host || "smtp.gmail.com",
    port: toPort(account.port),
    secure: account.secure === "true",
    auth: account.user ? { user: account.user, pass: account.pass } : undefined,
  })
  // Prefer the requested profile's own From (send-as), else the sending
  // account's configured From, else a safe default.
  const from = requested.from || account.from || "DNMS <noreply@digitallynext.com>"
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
    port: toPort(await getConfig("SMTP_PORT")),
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
