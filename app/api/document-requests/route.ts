import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
import type { Session } from "next-auth"

const employeeSelect = {
  select: { id: true, firstName: true, lastName: true, employeeNo: true, profilePhoto: true },
}

export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const sp = new URL(req.url).searchParams
      const canManage = hasPermission(session, PERMISSIONS.DOCUMENT_WRITE)
      const where: Record<string, unknown> = {}
      if (!canManage) where.employeeId = session.user.id
      else if (sp.get("employeeId")) where.employeeId = sp.get("employeeId")
      if (sp.get("status")) where.status = sp.get("status")

      const requests = await db.documentRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { employee: employeeSelect, requestedBy: employeeSelect },
      })
      return NextResponse.json({ data: requests })
    } catch (error) {
      console.error("[DOC_REQUESTS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      if (!hasPermission(session, PERMISSIONS.DOCUMENT_WRITE)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const { employeeId, title, category, note, dueDate } = await req.json()
      if (!employeeId || !title?.trim()) {
        return NextResponse.json({ error: "employeeId and title are required" }, { status: 400 })
      }

      const request = await db.documentRequest.create({
        data: {
          employeeId,
          requestedById: session.user.id,
          title: String(title).trim(),
          category: category || "OTHER",
          note: note || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          status: "PENDING",
        },
        include: { employee: employeeSelect, requestedBy: employeeSelect },
      })

      await createNotification({
        employeeId,
        title: "Document requested",
        message: `HR requested you upload "${request.title}".${dueDate ? ` Due ${new Date(dueDate).toDateString()}.` : ""}`,
        type: "info",
        link: "/profile",
      })

      return NextResponse.json({ data: request }, { status: 201 })
    } catch (error) {
      console.error("[DOC_REQUESTS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
