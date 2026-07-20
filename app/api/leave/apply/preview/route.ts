import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { db } from "@/server/db"
import { getConfigSync, warmConfig } from "@/server/app-config"
import { signatureLogoUrl } from "@/lib/email-layout"
import {
  resolveApprovalRoute,
  resolveLeaveMailEnvelope,
} from "@/features/leave/server/leave.service"
import type { Session } from "next-auth"

// GET /api/leave/apply/preview
// The envelope for the leave letter the CURRENT user is about to send: who it's
// addressed to, and whether HR is CC'd. Read-only - nothing is created.
//
// It calls resolveLeaveMailEnvelope(), the SAME function the send path uses, so
// the preview can't show a different recipient than the one we actually mail.
export const GET = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const me = session.user.id
      const route = await resolveApprovalRoute(
        me,
        session.user.roles ?? [],
        session.user.permissions ?? [],
      )
      const envelope = await resolveLeaveMailEnvelope(me, route)

      // Signature data comes from the server (same source the email template
      // uses), so the preview shows the real block rather than a lookalike.
      const applicant = await db.employee.findUnique({
        where: { id: me },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          jobRole: { select: { name: true } },
          designation: { select: { title: true } },
        },
      })
      // Populate the config cache so the sync getConfigSync() reads below see the
      // DB-stored company/social values, not just process.env.
      await warmConfig()

      return NextResponse.json({
        data: {
          autoApprove: envelope.autoApprove,
          to: envelope.to ? { name: envelope.to.name, email: envelope.to.email } : null,
          ccHr: envelope.ccHr,
          signature: applicant
            ? {
                name: `${applicant.firstName} ${applicant.lastName}`.trim(),
                // Job role first; fall back to the L-grade designation.
                designation: applicant.jobRole?.name ?? applicant.designation?.title ?? null,
                email: applicant.email,
                phone: applicant.phone,
                website: getConfigSync("COMPANY_WEBSITE") ?? null,
                address: getConfigSync("COMPANY_ADDRESS") ?? null,
                logoUrl: signatureLogoUrl(),
                socials: [
                  { label: "LinkedIn", url: getConfigSync("SOCIAL_LINKEDIN") ?? "" },
                  { label: "Instagram", url: getConfigSync("SOCIAL_INSTAGRAM") ?? "" },
                  { label: "YouTube", url: getConfigSync("SOCIAL_YOUTUBE") ?? "" },
                ].filter((s) => s.url),
              }
            : null,
        },
      })
    } catch (error) {
      console.error("[LEAVE_APPLY_PREVIEW]", error)
      return NextResponse.json({ error: "Could not load the approval preview" }, { status: 500 })
    }
  },
)
