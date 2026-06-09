import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession, hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// PATCH { action: "FULFILL" | "CANCEL" }. Employee can fulfill their own;
// HR (document:write) can fulfill or cancel any.
export const PATCH = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params
      const { action } = await req.json()
      if (!["FULFILL", "CANCEL"].includes(action)) {
        return NextResponse.json({ error: "action must be FULFILL or CANCEL" }, { status: 400 })
      }

      const reqRow = await db.documentRequest.findUnique({ where: { id } })
      if (!reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 })

      const canManage = hasPermission(session, PERMISSIONS.DOCUMENT_WRITE)
      const isOwner = reqRow.employeeId === session.user.id
      if (action === "CANCEL" && !canManage) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      if (action === "FULFILL" && !canManage && !isOwner) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const updated = await db.documentRequest.update({
        where: { id },
        data: { status: action === "FULFILL" ? "FULFILLED" : "CANCELLED" },
      })
      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[DOC_REQUEST_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
