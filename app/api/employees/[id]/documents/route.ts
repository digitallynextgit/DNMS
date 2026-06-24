import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import {
  getEmployeeDocuments,
  uploadEmployeeDocument,
} from "@/features/documents/server/employee-documents.actions"
import type { Session } from "next-auth"

/**
 * GET /api/employees/[id]/documents - list an employee's personal documents.
 */
export const GET = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const { id } = ctx.params
    const result = await getEmployeeDocuments(id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result.data)
  },
)

/**
 * POST /api/employees/[id]/documents - upload a personal document.
 *
 * Uses a Route Handler (not a Server Action) so large files aren't capped by the
 * default 1 MB Server-Action body limit. Auth + validation live in the action.
 */
export const POST = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params
      const formData = await req.formData()
      const result = await uploadEmployeeDocument(id, formData)
      if (!result.ok) {
        return NextResponse.json({ error: result.error, details: result.details }, { status: 400 })
      }
      return NextResponse.json(result.data)
    } catch (error) {
      console.error("[EMPLOYEE_DOCUMENTS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
