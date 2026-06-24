import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { sendEmailAs } from "@/lib/mailer"
import type { Session } from "next-auth"

// POST /api/recruitment/applicants/[id]/offer
// Body: { designation, ctc, joiningDate, location? } - emails a formatted offer
// letter to the applicant (sent FROM the acting HR user via sendEmailAs) and
// moves them to the OFFER stage.
export const POST = withAuth(
  PERMISSIONS.RECRUITMENT_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params
      const { designation, ctc, joiningDate, location } = await req.json()

      const applicant = await db.applicant.findUnique({
        where: { id },
        include: {
          jobPosting: { select: { title: true, department: { select: { name: true } } } },
        },
      })
      if (!applicant) return NextResponse.json({ error: "Applicant not found" }, { status: 404 })
      if (!designation || !ctc) {
        return NextResponse.json({ error: "designation and ctc are required" }, { status: 400 })
      }

      const fullName = `${applicant.firstName} ${applicant.lastName}`.trim()
      const company = process.env.COMPANY_NAME || "Digitally Next"
      const dateLine = joiningDate ? new Date(joiningDate).toDateString() : "to be confirmed"

      await sendEmailAs(session.user.id, {
        to: applicant.email,
        subject: `Offer of Employment - ${designation} at ${company}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;">
            <h2 style="color:#1d4ed8;">Offer of Employment</h2>
            <p>Dear ${fullName},</p>
            <p>We are delighted to offer you the position of <strong>${designation}</strong>${applicant.jobPosting?.department?.name ? ` in ${applicant.jobPosting.department.name}` : ""} at <strong>${company}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;">
              <tr><td style="padding:4px 0;color:#555;">Designation</td><td style="text-align:right;">${designation}</td></tr>
              <tr><td style="padding:4px 0;color:#555;">Annual CTC</td><td style="text-align:right;">₹${Number(ctc).toLocaleString("en-IN")}</td></tr>
              <tr><td style="padding:4px 0;color:#555;">Joining date</td><td style="text-align:right;">${dateLine}</td></tr>
              ${location ? `<tr><td style="padding:4px 0;color:#555;">Location</td><td style="text-align:right;">${location}</td></tr>` : ""}
            </table>
            <p>Please reply to this email to confirm your acceptance. We look forward to welcoming you to the team.</p>
            <p style="color:#666;font-size:13px;">Warm regards,<br/>${company} - People Team</p>
          </div>`,
        text: `Dear ${fullName}, we are pleased to offer you the role of ${designation} at ${company}. Annual CTC ₹${Number(ctc).toLocaleString("en-IN")}, joining ${dateLine}. Please reply to confirm.`,
      })

      const updated = await db.applicant.update({
        where: { id },
        data: { stage: "OFFER" },
      })

      return NextResponse.json({ data: updated, message: "Offer letter sent" })
    } catch (error) {
      console.error("[APPLICANT_OFFER_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
