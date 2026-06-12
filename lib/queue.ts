import { sendEmail, type MailerProfile } from "@/lib/mailer"

export interface EmailJobData {
  to: string
  subject: string
  html: string
  text?: string
  logId?: string
  // Which configured mailbox to send from (default "default"). Use "notifications"
  // for system mail (credentials, alerts) so it goes out via the Brevo relay.
  profile?: MailerProfile
}

// Sends email directly without a queue (no Redis/BullMQ dependency).
// Fire-and-forget: errors are logged but do not fail the calling request.
export async function addEmailJob(data: EmailJobData): Promise<void> {
  sendEmail({
    to: data.to,
    subject: data.subject,
    html: data.html,
    text: data.text,
    profile: data.profile,
  }).catch((err) => console.error("[email] Failed to send to", data.to, ":", err))
}
