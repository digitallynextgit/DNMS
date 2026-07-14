import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { addEmailAsJob } from "@/lib/queue"
import type { Session } from "next-auth"

const STAGE_EMAIL_CONFIG: Record<
  string,
  { subject: (jobTitle: string) => string; body: (name: string, jobTitle: string) => string }
> = {
  SCREENING: {
    subject: (jobTitle: string) => `You've been shortlisted for ${jobTitle}`,
    body: (name: string, jobTitle: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Shortlisted!</h2>
        <p>Hi ${name},</p>
        <p>Congratulations! You have been <strong>shortlisted</strong> for the position of <strong>${jobTitle}</strong>.</p>
        <p>Our HR team will be in touch shortly to discuss the next steps in the process.</p>
        <p style="color:#666;font-size:14px;">Thank you for your interest in joining our team.</p>
      </div>
    `,
  },
  OFFER: {
    subject: (jobTitle: string) => `Offer Letter - ${jobTitle}`,
    body: (name: string, jobTitle: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Offer Extended</h2>
        <p>Hi ${name},</p>
        <p>We are pleased to inform you that we would like to extend an <strong>offer of employment</strong> for the role of <strong>${jobTitle}</strong>.</p>
        <p>Our HR team will contact you shortly with the official offer letter and further details.</p>
        <p style="color:#666;font-size:14px;">We look forward to having you on our team!</p>
      </div>
    `,
  },
  HIRED: {
    subject: (jobTitle: string) => `Welcome to the team - ${jobTitle}`,
    body: (name: string, jobTitle: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Welcome Aboard!</h2>
        <p>Hi ${name},</p>
        <p>We are thrilled to confirm that you have been <strong>selected</strong> for the role of <strong>${jobTitle}</strong>.</p>
        <p>Our HR team will reach out with your onboarding details, start date, and everything you need to get started.</p>
        <p style="color:#666;font-size:14px;">Welcome to the team - we can't wait to work with you!</p>
      </div>
    `,
  },
}

export const PATCH = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json()
      const prevApplicant = await db.applicant.findUnique({
        where: { id: ctx.params.id },
        include: { jobPosting: { select: { title: true } } },
      })

      const applicant = await db.applicant.update({
        where: { id: ctx.params.id },
        data: {
          ...(body.stage !== undefined && { stage: body.stage as never }),
          ...(body.firstName !== undefined && { firstName: body.firstName }),
          ...(body.lastName !== undefined && { lastName: body.lastName }),
          ...(body.email !== undefined && { email: body.email }),
          ...(body.phone !== undefined && { phone: body.phone || null }),
          ...(body.notes !== undefined && { notes: body.notes || null }),
          ...(body.resumeUrl !== undefined && { resumeUrl: body.resumeUrl || null }),
          ...(body.rejectionReason !== undefined && {
            rejectionReason: body.rejectionReason ?? null,
          }),
        },
        include: { jobPosting: { select: { title: true } } },
      })

      // Send stage-change email if email is available and stage changed
      if (
        body.stage &&
        body.stage !== prevApplicant?.stage &&
        applicant.email &&
        STAGE_EMAIL_CONFIG[body.stage]
      ) {
        const cfg = STAGE_EMAIL_CONFIG[body.stage]
        const firstName = applicant.firstName
        const jobTitle = applicant.jobPosting?.title ?? "the position"
        try {
          addEmailAsJob(session.user.id, {
            to: applicant.email,
            subject: cfg.subject(jobTitle),
            html: cfg.body(firstName, jobTitle),
            text: `Hi ${firstName}, your application for ${jobTitle} has been updated. Please check your email for details.`,
          })
        } catch (_emailErr) {
          // Non-blocking
        }
      }

      return NextResponse.json({ data: applicant })
    } catch (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      await db.applicant.delete({ where: { id: ctx.params.id } })
      return NextResponse.json({ message: "Applicant deleted" })
    } catch (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
