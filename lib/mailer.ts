import nodemailer, { type Transporter } from "nodemailer"
import type { EmailTemplate } from "@prisma/client"
import { db } from "@/lib/db"
import { tryDecrypt } from "@/lib/crypto"

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

// Read a config value for a profile, falling back to the base SMTP_* var.
function profileEnv(profile: string, key: string): string | undefined {
  if (profile !== "default") {
    const scoped = process.env[`SMTP_${profile.toUpperCase()}_${key}`]
    if (scoped) return scoped
  }
  return process.env[`SMTP_${key}`]
}

// One cached transporter per profile (built lazily on first use).
const transporters = new Map<string, Transporter>()

function getProfile(profile: string): { transporter: Transporter; from: string } {
  let transporter = transporters.get(profile)
  if (!transporter) {
    const user = profileEnv(profile, "USER")
    const pass = profileEnv(profile, "PASS")
    transporter = nodemailer.createTransport({
      host: profileEnv(profile, "HOST") || "smtp.gmail.com",
      port: parseInt(profileEnv(profile, "PORT") || "587", 10),
      secure: profileEnv(profile, "SECURE") === "true",
      auth: user ? { user, pass } : undefined,
    })
    transporters.set(profile, transporter)
  }
  const from = profileEnv(profile, "FROM") || "DNMS <noreply@digitallynext.com>"
  return { transporter, from }
}

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>
  replyTo?: string
  // Which configured mailbox to send from (default: "default").
  profile?: MailerProfile
  // Explicit From override; wins over the profile's configured From.
  from?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const { transporter, from } = getProfile(options.profile ?? "default")
  await transporter.sendMail({
    from: options.from ?? from,
    to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
    replyTo: options.replyTo,
  })
}

/**
 * Sends an email impersonating the given employee, using their stored Gmail App Password.
 * Falls back to the system mailer (sendEmail) if the employee has no App Password set.
 *
 * Use for emails that should appear to come from a specific person - e.g. a manager
 * approving a leave, a recruiter sending a stage-change message. System-level mail
 * (password resets, birthdays) should keep using sendEmail.
 */
export async function sendEmailAs(employeeId: string, options: SendEmailOptions): Promise<void> {
  const emp = await db.employee.findUnique({
    where: { id: employeeId },
    select: { email: true, firstName: true, lastName: true, gmailAppPassword: true },
  })

  // No employee or no App Password on file → fall back to the shared system mailer.
  if (!emp?.gmailAppPassword) {
    await sendEmail(options)
    return
  }

  const password = tryDecrypt(emp.gmailAppPassword)
  if (!password) {
    console.error(
      "[sendEmailAs] Failed to decrypt App Password for",
      employeeId,
      "- falling back to system mailer",
    )
    await sendEmail(options)
    return
  }

  // Build a one-off transporter for this employee, send, discard.
  const perUser = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: emp.email, pass: password },
  })

  const fromName = `${emp.firstName} ${emp.lastName}`.trim() || emp.email

  try {
    await perUser.sendMail({
      from: `"${fromName}" <${emp.email}>`,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
      replyTo: options.replyTo,
    })
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
