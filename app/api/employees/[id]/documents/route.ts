import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  getEmployeeDocuments,
  uploadEmployeeDocument,
} from "@/features/documents/server/employee-documents.service"

export const GET = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  return respond(await getEmployeeDocuments(id))
})

// A route handler, not a Server Action, so large files aren't capped by the 1 MB action body limit.
export const POST = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  const formData = await req.formData()
  return respond(await uploadEmployeeDocument(id, formData))
})
