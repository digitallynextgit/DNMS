import { sendEmail } from "@/lib/mailer"

export interface EmailJobData {
  to: string
  subject: string
  html: string
  text?: string
  logId?: string
}

// Sends email directly without a queue (no Redis/BullMQ dependency).
// Fire-and-forget: errors are logged but do not fail the calling request.
export async function addEmailJob(data: EmailJobData): Promise<void> {
  sendEmail({ to: data.to, subject: data.subject, html: data.html, text: data.text }).catch((err) =>
    console.error("[email] Failed to send to", data.to, ":", err),
  )
}
