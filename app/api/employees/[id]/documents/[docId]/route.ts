import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  getEmployeeDocumentUrl,
  deleteEmployeeDocument,
} from "@/features/documents/server/employee-documents.service"

/**
 * GET /api/employees/[id]/documents/[docId] - short-lived presigned download URL
 * (?download=1 forces a download instead of an inline view).
 */
export const GET = withErrorHandler(
  async (req: NextRequest, ctx: { params: { id: string; docId: string } }) => {
    const { id, docId } = ctx.params
    const download = req.nextUrl.searchParams.get("download") === "1"
    return respond(await getEmployeeDocumentUrl(id, docId, { download }))
  },
)

/**
 * DELETE /api/employees/[id]/documents/[docId] - delete a personal document.
 */
export const DELETE = withErrorHandler(
  async (_req: NextRequest, ctx: { params: { id: string; docId: string } }) => {
    const { id, docId } = ctx.params
    return respond(await deleteEmployeeDocument(id, docId))
  },
)
