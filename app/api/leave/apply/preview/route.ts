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

// Uses resolveLeaveMailEnvelope(), like the send path, so the preview can't show a different recipient.
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
      // Load DB config into the cache so getConfigSync() below sees it, not just process.env.
      await warmConfig()

      return NextResponse.json({
        data: {
          autoApprove: envelope.autoApprove,
          to: envelope.to ? { name: envelope.to.name, email: envelope.to.email } : null,
          ccHr: envelope.ccHr,
          signature: applicant
            ? {
                name: `${applicant.firstName} ${applicant.lastName}`.trim(),
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
