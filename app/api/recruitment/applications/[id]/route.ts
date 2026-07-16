import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { createAuditLog } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

const STATUSES = ["RECEIVED", "IN_REVIEW", "SHORTLISTED", "REJECTED", "HIRED"] as const
type AppStatus = (typeof STATUSES)[number]

// GET /api/recruitment/applications/[id] - one application (HR detail view).
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
      return NextResponse.json({ data: application })
    } catch (error) {
      console.error("[RECRUITMENT_APPLICATION_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// PATCH /api/recruitment/applications/[id] - move it through the pipeline / add notes.
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

      const updated = await db.careerApplication.update({ where: { id: ctx.params.id }, data })

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
