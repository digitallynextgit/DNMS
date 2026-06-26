import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  getEmployeeDocuments,
  uploadEmployeeDocument,
} from "@/features/documents/server/employee-documents.service"

/**
 * GET /api/employees/[id]/documents - list an employee's personal documents.
 */
export const GET = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  return respond(await getEmployeeDocuments(id))
})

/**
 * POST /api/employees/[id]/documents - upload a personal document.
 *
 * Uses a Route Handler (not a Server Action) so large files aren't capped by the
 * default 1 MB Server-Action body limit. Auth + validation live in the service.
 */
export const POST = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  const formData = await req.formData()
  return respond(await uploadEmployeeDocument(id, formData))
})
