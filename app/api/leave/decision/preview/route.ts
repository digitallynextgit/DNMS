import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { db } from "@/server/db"
import { getConfigSync, warmConfig } from "@/server/app-config"
import { signatureLogoUrl } from "@/lib/email-layout"
import type { Session } from "next-auth"

type Person = {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  jobRole: { name: string } | null
  designation: { title: string } | null
} | null

const PERSON_SELECT = {
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  jobRole: { select: { name: true } },
  designation: { select: { title: true } },
} as const

// GET /api/leave/decision/preview?requestId=<id>
// The signature block that will sign the decision reply. That reply is sent FROM
// the applicant's reporting MANAGER, so we return the manager's signature (falling
// back to the current user when there's no manager on file). Read-only.
export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const requestId = req.nextUrl.searchParams.get("requestId")

      let person: Person = null
      if (requestId) {
        const request = await db.leaveRequest.findUnique({
          where: { id: requestId },
          select: { employee: { select: { manager: { select: PERSON_SELECT } } } },
        })
        person = request?.employee.manager ?? null
      }
      // Fallback: the current user (e.g. no manager assigned).
      if (!person) {
        person = await db.employee.findUnique({
          where: { id: session.user.id },
          select: PERSON_SELECT,
        })
      }

      await warmConfig()

      return NextResponse.json({
        data: {
          signature: person
            ? {
                name: `${person.firstName} ${person.lastName}`.trim(),
                designation: person.jobRole?.name ?? person.designation?.title ?? null,
                email: person.email,
                phone: person.phone,
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
