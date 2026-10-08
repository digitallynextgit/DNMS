import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { createAuditLog } from "@/lib/audit"
import { getSignedUrl } from "@/lib/storage"
import { notifyReferrerOfStage } from "@/features/referrals/server/referrals.service"
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/constants"
import type { Session } from "next-auth"

const STATUSES = ["RECEIVED", "IN_REVIEW", "SHORTLISTED", "REJECTED", "HIRED"] as const
type AppStatus = (typeof STATUSES)[number]

// Deleting destroys a real submission, so recruitment:write (which hr_employee holds) isn't enough -
// admin or HR manager only.
function canDelete(session: Session): boolean {
  const roles = session.user.roles ?? []
  return (
    roles.includes(SYSTEM_ROLES.ADMIN) ||
    roles.includes(SYSTEM_ROLES.ADMIN_) ||
    roles.includes(SYSTEM_ROLES.HR_MANAGER)
  )
}

export const GET = withAuth(
  PERMISSIONS.RECRUITMENT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const application = await db.careerApplication.findUnique({
        where: { id: ctx.params.id },
        include: {
          careerRole: {
            select: { id: true, title: true, slug: true, status: true },
          },
        },
      })
      if (!application) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 })
      }
      // Prefer our stored CV copy over the external link.
      const data = application.resumeKey
        ? {
            ...application,
            resumeUrl: await getSignedUrl(application.resumeKey, 3600).catch(
              () => application.resumeUrl,
            ),
          }
        : application
      return NextResponse.json({ data })
    } catch (error) {
      console.error("[RECRUITMENT_APPLICATION_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const PATCH = withAuth(
  PERMISSIONS.RECRUITMENT_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json()
      const data: { status?: AppStatus; hrNotes?: string | null } = {}

      if (body.status !== undefined) {
        if (!STATUSES.includes(body.status)) {
          return NextResponse.json(
            { error: `status must be one of: ${STATUSES.join(", ")}` },
            { status: 422 },
          )
        }
        data.status = body.status
      }
      if (body.hrNotes !== undefined) {
        data.hrNotes = typeof body.hrNotes === "string" ? body.hrNotes.slice(0, 5000) : null
      }
      if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
      }

      // Read the prior status so the referrer is notified only on a real transition.
      const prior = await db.careerApplication.findUnique({
        where: { id: ctx.params.id },
        select: { status: true },
      })
      if (!prior) return NextResponse.json({ error: "Application not found" }, { status: 404 })

      const updated = await db.careerApplication.update({ where: { id: ctx.params.id }, data })

      if (data.status !== undefined && data.status !== prior.status) {
        await notifyReferrerOfStage(ctx.params.id)
      }

      // Applicant PII is audited by reference (id + status), never by content.
      await createAuditLog(session, {
        action: "UPDATE",
        module: "recruitment",
        entityType: "CareerApplication",
        entityId: ctx.params.id,
        changes: { status: data.status, notesUpdated: data.hrNotes !== undefined } as object,
      })

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[RECRUITMENT_APPLICATION_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withAuth(
  PERMISSIONS.RECRUITMENT_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      if (!canDelete(session)) {
        return NextResponse.json(
          { error: "Only an admin or HR manager can delete an application" },
          { status: 403 },
        )
      }

      const existing = await db.careerApplication.findUnique({
        where: { id: ctx.params.id },
        select: { id: true, roleTitle: true },
      })
      if (!existing) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 })
      }

      await db.careerApplication.delete({ where: { id: ctx.params.id } })

      await createAuditLog(session, {
        action: "DELETE",
        module: "recruitment",
        entityType: "CareerApplication",
        entityId: ctx.params.id,
        changes: { roleTitle: existing.roleTitle } as object,
      })

      return NextResponse.json({ message: "Application deleted" })
    } catch (error) {
      console.error("[RECRUITMENT_APPLICATION_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
