import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { db } from "@/server/db"
import { getConfigSync, warmConfig } from "@/server/app-config"
import { signatureLogoUrl } from "@/lib/email-layout"
import type { Session } from "next-auth"

// GET /api/leave/decision/preview
// The signature block for the CURRENT user (the approver) - so the approve/reject
// dialog can preview the reply exactly as it will be sent. Read-only.
export const GET = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const approver = await db.employee.findUnique({
        where: { id: session.user.id },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          jobRole: { select: { name: true } },
          designation: { select: { title: true } },
        },
      })
      await warmConfig()

      return NextResponse.json({
        data: {
          signature: approver
            ? {
                name: `${approver.firstName} ${approver.lastName}`.trim(),
                designation: approver.jobRole?.name ?? approver.designation?.title ?? null,
                email: approver.email,
                phone: approver.phone,
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
      console.error("[LEAVE_DECISION_PREVIEW]", error)
      return NextResponse.json({ error: "Could not load the signature preview" }, { status: 500 })
    }
  },
)
