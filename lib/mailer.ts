import nodemailer from "nodemailer"
import type { EmailTemplate } from "@prisma/client"
import { db } from "@/server/db"
import { tryDecrypt } from "@/lib/crypto"
import { getConfig } from "@/server/app-config"
import { isDemoEmail } from "@/lib/demo"

// Mailer profiles: each reads SMTP_<PROFILE>_* (DB -> env); "default" uses plain SMTP_*. A profile
// without credentials falls back down the chain to the mandatory "notifications" profile.
// Host/user/pass always come from one profile, never mixed.
export type MailerProfile = "default" | "notifications" | "hr" | (string & {})

interface ProfileConfig {
  from?: string
  host?: string
  port?: string
  secure?: string
  user?: string
  pass?: string
}

function keyPrefix(profile: string): string {
  return profile === "default" ? "SMTP_" : `SMTP_${profile.toUpperCase()}_`
}

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

function hasCredentials(c: ProfileConfig): boolean {
  return Boolean(c.host && c.user && c.pass)
}

// Falls back to 587 so a stray value never gives a NaN port.
function toPort(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10)
  return Number.isNaN(n) ? 587 : n
}

function fallbackChain(profile: string): string[] {
  if (profile === "notifications") return ["notifications"]
  if (profile === "default") return ["default", "notifications"]
  return [profile, "default", "notifications"] // hr or any custom profile
}

// Read fresh each time, so SMTP edits on the Integrations page apply immediately.
async function buildProfile(profile: string) {
  const requested = await readProfile(profile)

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
  // Nothing can authenticate: fail here with a clear message, not a cryptic 530 from Gmail.
  if (!account || !hasCredentials(account)) {
    throw new Error(
      `SMTP is not configured: no profile in the "${profile}" fallback chain has host+user+pass. ` +
        `Set the notifications mailer in Admin → Integrations (or SMTP_NOTIFICATIONS_* env).`,
    )
  }

  const transporter = getTransporter({
    host: account.host!,
    port: toPort(account.port),
    secure: account.secure === "true",
    auth: { user: account.user!, pass: account.pass },
  })
  const from = requested.from || account.from || "DNMS <noreply@digitallynext.com>"
  return { transporter, from }
}

// Transporters are pooled and cached by exact SMTP config, so connections are reused; a config
// change just builds a new one.
type SmtpConfig = {
  host: string
  port: number
  secure: boolean
  auth?: { user: string; pass?: string }
}

const transporterCache = new Map<string, nodemailer.Transporter>()

function getTransporter(cfg: SmtpConfig): nodemailer.Transporter {
  const key = JSON.stringify(cfg)
  const cached = transporterCache.get(key)
  if (cached) return cached
  const transporter = nodemailer.createTransport({
    ...cfg,
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    // Fail in seconds rather than hang for the OS TCP timeout when the SMTP host is dead.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
  transporterCache.set(key, transporter)
  return transporter
}

interface SendEmailOptions {
  to: string | string[]
  cc?: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>
  replyTo?: string
  // Set both to a prior Message-ID to reply on the same thread.
  inReplyTo?: string
  references?: string | string[]
  // Set when a later email needs to reply onto this one's thread.
  messageId?: string
  profile?: MailerProfile
  from?: string
}

/** Demo-workspace addresses (lib/demo.ts) are dropped here - every send path goes through this. */
function addressList(value?: string | string[]): string | undefined {
  if (!value) return undefined
  const all = (Array.isArray(value) ? value : value.split(","))
    .map((a) => a.trim())
    .filter((a) => a && !isDemoEmail(a))
  return all.length ? all.join(", ") : undefined
}

export async function sendEmail(options: SendEmailOptions): Promise<string | null> {
  const to = addressList(options.to)
  const cc = addressList(options.cc)
  // Only demo addresses - nothing to send.
  if (!to && !cc) return null
  const { transporter, from } = await buildProfile(options.profile ?? "default")
  // No close(): the transporter is pooled and shared.
  const info = await transporter.sendMail({
    from: options.from ?? from,
    to,
    cc,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
    replyTo: options.replyTo,
    inReplyTo: options.inReplyTo,
    references: options.references,
    messageId: options.messageId,
  })
  return info.messageId ?? null
}

/**
 * Sends as the employee via their Gmail App Password, else falls back to sendEmail. For mail that
 * should come from a person (approvals, recruiter messages), not system mail.
 */
export async function sendEmailAs(
  employeeId: string,
  options: SendEmailOptions,
): Promise<string | null> {
  const emp = await db.employee.findUnique({
    where: { id: employeeId },
    select: { email: true, firstName: true, lastName: true, gmailAppPassword: true },
  })

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

  const perUser = getTransporter({
    host: (await getConfig("SMTP_HOST")) || "smtp.gmail.com",
    port: toPort(await getConfig("SMTP_PORT")),
    secure: (await getConfig("SMTP_SECURE")) === "true",
    auth: { user: emp.email, pass: password },
  })

  const fromName = `${emp.firstName} ${emp.lastName}`.trim() || emp.email
  const to = addressList(options.to)
  const cc = addressList(options.cc)
  if (!to && !cc) return null

  const info = await perUser.sendMail({
    from: `"${fromName}" <${emp.email}>`,
    to,
    cc,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
    replyTo: options.replyTo,
    inReplyTo: options.inReplyTo,
    references: options.references,
    messageId: options.messageId,
  })
  return info.messageId ?? null
}

export interface ExplicitSmtp {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
  replyTo?: string
}

/** Sends through an arbitrary SMTP account (e.g. a project's client domain), still pooled. Throws on failure. */
export async function sendEmailWithSmtp(
  smtp: ExplicitSmtp,
  options: Omit<SendEmailOptions, "profile" | "from">,
): Promise<string | null> {
  const transporter = getTransporter({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  })
  const info = await transporter.sendMail({
    from: smtp.from,
    to: addressList(options.to),
    cc: addressList(options.cc),
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
    replyTo: options.replyTo ?? smtp.replyTo,
    inReplyTo: options.inReplyTo,
    references: options.references,
    messageId: options.messageId,
  })
  return info.messageId ?? null
}

/** Opens the connection and authenticates, without sending. */
export async function verifySmtp(smtp: Omit<ExplicitSmtp, "from" | "replyTo">): Promise<void> {
  const transporter = getTransporter({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  })
  await transporter.verify()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
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
    // Values are data, not markup: escape them so they can't inject HTML.
    html = html.replace(regex, escapeHtml(value))
  }

  return { subject, html }
}
