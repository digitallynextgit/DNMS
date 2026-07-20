/**
 * Smoke test: send a leave "application" email with a deterministic Message-ID,
 * then send the approve "decision" email as a Re: reply that threads onto it -
 * exactly the plumbing the real apply -> approve flow uses.
 *
 *   node --env-file=.env --conditions=react-server --import tsx scripts/smoke-thread.mts
 */
import { sendEmail } from "@/lib/mailer"
import { renderLeaveRequestEmail, renderDecisionEmail } from "@/lib/email-layout"
import { warmConfig } from "@/server/app-config"

const TO = "diwakarjha554@gmail.com"

async function main() {
  await warmConfig() // so the signature block reads company/social config

  const start = "2026-07-24"
  const end = "2026-07-24"
  const messageId = `<leave-smoke-${Date.now()}@dnms.digitallynext.com>`

  // 1) The application letter (what the manager receives).
  const application = renderLeaveRequestEmail({
    approverFirstName: "Manpreet",
    applicantName: "Diwakar Jha",
    employeeNo: "145",
    designation: "Full Stack Developer",
    department: "Web Development",
    applicantEmail: "diwakar@digitallynext.com",
    applicantPhone: "8882617743",
    leaveType: "Casual Leave",
    startDate: start,
    endDate: end,
    totalDays: 1,
    reason: "Attending a family function.",
  })

  const id1 = await sendEmail({
    to: TO,
    subject: application.subject,
    html: application.html,
    text: application.text,
    replyTo: "diwakar@digitallynext.com",
    messageId,
    profile: "notifications",
  })
  console.log("[1/2] application sent")
  console.log("      subject   :", application.subject)
  console.log("      set msgid :", messageId)
  console.log("      smtp msgid:", id1)

  // small gap so the two land in order
  await new Promise((r) => setTimeout(r, 3000))

  // 2) The approval decision, threaded onto (1).
  const decision = renderDecisionEmail({
    kind: "Leave request",
    approved: true,
    firstName: "Diwakar",
    detailLine: `Casual Leave · ${new Date(start).toDateString()} (1 day)`,
    reason: null,
  })

  const id2 = await sendEmail({
    to: TO,
    subject: `Re: ${application.subject}`,
    html: decision.html,
    text: decision.text,
    inReplyTo: messageId,
    references: messageId,
    profile: "default",
  })
  console.log("[2/2] decision reply sent")
  console.log("      subject   : Re:", application.subject)
  console.log("      in-reply-to:", messageId)
  console.log("      smtp msgid:", id2)

  console.log("\nDone. Check", TO, "- the approval should sit under the application as one thread.")
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SMOKE TEST FAILED:", err)
    process.exit(1)
  })
