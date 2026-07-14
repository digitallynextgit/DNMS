import { sendEmail, sendEmailAs, type MailerProfile } from "@/lib/mailer"

export interface EmailJobData {
  to: string | string[]
  cc?: string | string[]
  subject: string
  html: string
  text?: string
  logId?: string
  replyTo?: string
  // Threading headers, so a decision email replies on the original thread.
  inReplyTo?: string
  references?: string | string[]
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>
  // Which configured mailbox to send from (default "default"). Use "notifications"
  // for system mail (credentials, alerts) so it goes out via the Brevo relay.
  profile?: MailerProfile
}

/**
 * Fire-and-forget email. Sends directly (no Redis/BullMQ) but, crucially, WITHOUT
 * blocking the caller: the promise is deliberately not awaited, so the HTTP
 * response returns immediately and the SMTP handshake happens after it.
 *
 * Use this for every email that is a SIDE EFFECT of an action (approval notices,
 * assignment alerts, payslip notices). Keep `await sendEmail(...)` only where the
 * send IS the action (password-reset OTP, offer letter), or where the caller needs
 * the returned Message-ID for email threading.
 */
export function addEmailJob(data: EmailJobData): void {
  void sendEmail({
    to: data.to,
    cc: data.cc,
    subject: data.subject,
    html: data.html,
    text: data.text,
    replyTo: data.replyTo,
    inReplyTo: data.inReplyTo,
    references: data.references,
    attachments: data.attachments,
    profile: data.profile,
  }).catch((err) => console.error("[email] Failed to send to", data.to, ":", err))
}

/** Fire-and-forget variant of {@link sendEmailAs} - sends as the given employee. */
export function addEmailAsJob(employeeId: string, data: EmailJobData): void {
  void sendEmailAs(employeeId, {
    to: data.to,
    cc: data.cc,
    subject: data.subject,
    html: data.html,
    text: data.text,
    replyTo: data.replyTo,
    inReplyTo: data.inReplyTo,
    references: data.references,
    attachments: data.attachments,
    profile: data.profile,
  }).catch((err) => console.error("[email] Failed to send as", employeeId, "to", data.to, ":", err))
}
