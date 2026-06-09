// Temporary throwaway: verifies SMTP auth for a given profile from .env.
// Run: node scripts/test-smtp.mjs notifications
import "dotenv/config"
import nodemailer from "nodemailer"

const profile = (process.argv[2] || "notifications").toUpperCase()
const pick = (key) => process.env[`SMTP_${profile}_${key}`] ?? process.env[`SMTP_${key}`]

const cfg = {
  host: pick("HOST"),
  port: parseInt(pick("PORT") || "587", 10),
  secure: pick("SECURE") === "true",
  user: pick("USER"),
  pass: pick("PASS"),
  from: pick("FROM"),
}

console.log("Testing profile:", profile)
console.log("  host:", cfg.host)
console.log("  port:", cfg.port, "secure:", cfg.secure)
console.log("  user:", cfg.user)
console.log("  pass:", cfg.pass ? `${cfg.pass.slice(0, 4)}…(${cfg.pass.length} chars)` : "(empty)")
console.log("  from:", cfg.from)

const transporter = nodemailer.createTransport({
  host: cfg.host,
  port: cfg.port,
  secure: cfg.secure,
  auth: { user: cfg.user, pass: cfg.pass },
})

try {
  await transporter.verify()
  console.log("\n✅ AUTH OK - credentials accepted by", cfg.host)
} catch (e) {
  console.log("\n❌ AUTH FAILED:", e.message)
  process.exit(1)
}

// If a recipient is passed as the 3rd arg, actually send a test email.
const to = process.argv[3]
if (to) {
  console.log(`\nSending test email to ${to} …`)
  try {
    const info = await transporter.sendMail({
      from: cfg.from,
      to,
      subject: "DNMS SMTP test",
      text: "If you can read this, Brevo SMTP delivery is working.",
      html: "<p>If you can read this, <b>Brevo SMTP delivery is working.</b></p>",
    })
    console.log("✅ SENT - Brevo accepted the message")
    console.log("   messageId:", info.messageId)
    console.log("   response :", info.response)
    console.log("   accepted :", info.accepted)
    console.log("   rejected :", info.rejected)
  } catch (e) {
    console.log("❌ SEND FAILED:", e.message)
  }
}
