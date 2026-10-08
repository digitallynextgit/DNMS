import { sendEmail, sendEmailAs, type MailerProfile } from "@/lib/mailer"

export interface EmailJobData {
  to: string | string[]
  cc?: string | string[]
  subject: string
  html: string
  text?: string
  logId?: string
  replyTo?: string
  inReplyTo?: string
  references?: string | string[]
  messageId?: string
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>
  // Use "notifications" for system mail (credentials, alerts) - it goes via the Brevo relay.
  profile?: MailerProfile
}

/**
 * Fire-and-forget email (not awaited, so the response returns first). Use for side-effect mail; keep
 * `await sendEmail` where the send IS the action or the Message-ID is needed for threading.
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
    messageId: data.messageId,
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
    messageId: data.messageId,
    attachments: data.attachments,
    profile: data.profile,
  }).catch((err) => console.error("[email] Failed to send as", employeeId, "to", data.to, ":", err))
}
