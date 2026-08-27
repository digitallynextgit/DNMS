import { NextRequest } from "next/server"
import { z } from "zod"

import { ok, fail } from "@/lib/api-response"
import { siteConfig } from "@/config/site"
import { sendEmail } from "@/lib/mailer"

// POST /api/public/contact
//
// DELIBERATELY UNAUTHENTICATED. It is the contact form on a public marketing
// page - the whole point is that the sender has no account. It lives under
// /api/public, which proxy.ts treats as session-exempt.
//
// It sends mail and nothing else: no database write, so there is no table for
// an abuser to fill. The protections are a honeypot field, a per-IP rate limit
// and a hard length cap on every input.
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
  /** Honeypot. Real people never see it, so anything here is a bot. */
  company_website: z.string().max(0).optional().or(z.literal("")),
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

// ---------------------------------------------------------------------------
// Per-IP rate limit: 5 messages an hour.
//
// In-process, so it resets on deploy and is per-instance rather than global.
// That is a deliberate floor, not a ceiling - it stops a bored script without
// adding a dependency. If this endpoint is ever abused in earnest, or the app
// is clustered across instances, move the counter to Redis or a table.
// ---------------------------------------------------------------------------
const WINDOW_MS = 60 * 60_000
const MAX_PER_WINDOW = 5
const ATTEMPTS = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (ATTEMPTS.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) {
    ATTEMPTS.set(ip, recent)
    return true
  }
  recent.push(now)
  ATTEMPTS.set(ip, recent)
  // Keep the map from growing without bound on a long-lived process.
  if (ATTEMPTS.size > 5000) {
    for (const [key, times] of ATTEMPTS) {
      if (times.every((t) => now - t >= WINDOW_MS)) ATTEMPTS.delete(key)
    }
  }
  return false
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
}

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

    if (rateLimited(clientIp(req))) {
      return fail(
        "RATE_LIMITED",
        "Too many messages from this address. Please try again later or email us directly.",
        429,
      )
    }

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

    await sendEmail({
      to: INBOX_FOR[topic],
      subject,
      html,
      text: `${SUBJECT_FOR[topic]}\n\nName: ${name}\nEmail: ${email}\n${company ? `Company: ${company}\n` : ""}Topic: ${topic}\n\n${message}`,
      // So hitting Reply in the inbox answers the person, not our own mailbox.
      replyTo: `${name} <${email}>`,
    })

    return ok({ sent: true })
  } catch (error) {
    // A public endpoint: an escaped throw here is a repeating fault visible to
    // anyone. Funnel it into a 500 and keep the detail in the logs.
    console.error("[CONTACT]", error)
    return fail("INTERNAL_ERROR", "We could not send your message. Please email us directly.", 500)
  }
}
