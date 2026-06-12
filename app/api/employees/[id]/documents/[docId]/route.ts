import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/lib/permissions"
import { getEmployeeDocumentUrl, deleteEmployeeDocument } from "@/lib/actions/employee-documents"
import type { Session } from "next-auth"

/**
 * GET /api/employees/[id]/documents/[docId] - short-lived presigned download URL.
 */
export const GET = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const { id, docId } = ctx.params
    const result = await getEmployeeDocumentUrl(id, docId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result.data)
  },
)

/**
 * DELETE /api/employees/[id]/documents/[docId] - delete a personal document.
 */
export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id, docId } = ctx.params
      const result = await deleteEmployeeDocument(id, docId)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json(result.data)
    } catch (error) {
      console.error("[EMPLOYEE_DOCUMENTS_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
