import { NextRequest } from "next/server"
import { z } from "zod"

import { ok, fail } from "@/lib/api-response"
import { siteConfig } from "@/config/site"
import { db } from "@/server/db"
import { sendEmail } from "@/lib/mailer"
import { rateLimited, clientIp } from "@/lib/rate-limit"

// POST /api/public/contact
//
// DELIBERATELY UNAUTHENTICATED. It is the contact form on a public marketing
// page - the whole point is that the sender has no account. It lives under
// /api/public, which proxy.ts treats as session-exempt.
//
// The enquiry is STORED FIRST (contact_enquiries), then the notification email
// is attempted - so an SMTP outage no longer loses a customer's message; it
// just marks the row emailSent=false. Abuse is bounded by the honeypot, the
// per-IP rate limit and hard length caps on every input.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TOPICS = ["sales", "demo", "support", "privacy", "other"] as const

const schema = z.object({
  name: z.string().trim().min(1, "Please tell us your name.").max(120),
  email: z.string().trim().email("That email address does not look right.").max(200),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  topic: z.enum(TOPICS).default("sales"),
  message: z
    .string()
    .trim()
    .min(10, "Please add a little more detail.")
    .max(4000, "Please keep it under 4000 characters."),
  /**
   * Honeypot. Real people never see it, so anything here is a bot. It must
   * PASS validation when filled (max(0) used to 422 first, which told the bot
   * it was caught before the pretend-success branch below could run).
   */
  company_website: z.string().max(500).optional().or(z.literal("")),
})

const SUBJECT_FOR: Record<(typeof TOPICS)[number], string> = {
  sales: "Sales enquiry",
  demo: "Demo request",
  support: "Support request",
  privacy: "Privacy / data request",
  other: "Website enquiry",
}

/** Route the message to the inbox that owns it. */
const INBOX_FOR: Record<(typeof TOPICS)[number], string> = {
  sales: siteConfig.emails.sales,
  demo: siteConfig.emails.sales,
  support: siteConfig.emails.support,
  privacy: siteConfig.emails.privacy,
  other: siteConfig.emails.sales,
}

// Per-IP rate limit: 5 messages an hour, through the shared limiter in
// lib/rate-limit.ts (which also reads the IP from the trusted end of the
// proxy headers - the local copy this replaced trusted the client-controlled
// first X-Forwarded-For hop).
const WINDOW_MS = 60 * 60_000
const MAX_PER_WINDOW = 5

/** Escape before interpolating user input into the notification email. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail("VALIDATION_ERROR", first?.message ?? "Invalid input", 422)
    }
    const { name, email, company, topic, message, company_website } = parsed.data

    // Honeypot tripped. Answer exactly as we would on success: telling a bot it
    // was detected only teaches whoever wrote it to fix the bot.
    if (company_website) return ok({ sent: true })

    if (rateLimited(`contact:${clientIp(req)}`, MAX_PER_WINDOW, WINDOW_MS)) {
      return fail(
        "RATE_LIMITED",
        "Too many messages from this address. Please try again later or email us directly.",
        429,
      )
    }

    // Store BEFORE sending: the row is the enquiry, the email is a notification.
    const enquiry = await db.contactEnquiry.create({
      data: { name, email, company: company || null, topic, message },
      select: { id: true },
    })

    const subject = `[${siteConfig.name}] ${SUBJECT_FOR[topic]} - ${name}`
    const html = `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:#111">
        <h2 style="margin:0 0 16px;font-size:16px">${esc(SUBJECT_FOR[topic])}</h2>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          <tr><td style="padding:4px 16px 4px 0;color:#666">Name</td><td style="padding:4px 0"><strong>${esc(name)}</strong></td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#666">Email</td><td style="padding:4px 0"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
          ${company ? `<tr><td style="padding:4px 16px 4px 0;color:#666">Company</td><td style="padding:4px 0">${esc(company)}</td></tr>` : ""}
          <tr><td style="padding:4px 16px 4px 0;color:#666">Topic</td><td style="padding:4px 0">${esc(topic)}</td></tr>
        </table>
        <p style="margin:20px 0 6px;color:#666">Message</p>
        <div style="white-space:pre-wrap;border-left:3px solid #ef4444;padding:8px 0 8px 14px">${esc(message)}</div>
        <p style="margin-top:24px;color:#999;font-size:12px">Sent from the contact form at ${esc(siteConfig.domain)}</p>
      </div>
    `

    try {
      await sendEmail({
        to: INBOX_FOR[topic],
        subject,
        html,
        text: `${SUBJECT_FOR[topic]}\n\nName: ${name}\nEmail: ${email}\n${company ? `Company: ${company}\n` : ""}Topic: ${topic}\n\n${message}`,
        // So hitting Reply in the inbox answers the person, not our own mailbox.
        // The name is stripped of CR/LF and address punctuation: it is user
        // input landing in an email HEADER, where a raw value could smuggle
        // extra headers or a second address.
        replyTo: `${name.replace(/[\r\n<>"]/g, " ").trim()} <${email}>`,
      })
      await db.contactEnquiry.update({ where: { id: enquiry.id }, data: { emailSent: true } })
    } catch (error) {
      // The enquiry IS saved - a notification failure is ours to notice (the
      // emailSent=false rows), not the sender's problem.
      console.error("[CONTACT] stored enquiry but the notification email failed:", error)
    }

    return ok({ sent: true })
  } catch (error) {
    // A public endpoint: an escaped throw here is a repeating fault visible to
    // anyone. Funnel it into a 500 and keep the detail in the logs.
    console.error("[CONTACT]", error)
    return fail("INTERNAL_ERROR", "We could not send your message. Please email us directly.", 500)
  }
}
