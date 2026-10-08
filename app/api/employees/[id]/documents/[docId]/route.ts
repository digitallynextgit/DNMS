import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  getEmployeeDocumentUrl,
  deleteEmployeeDocument,
} from "@/features/documents/server/employee-documents.service"

export const GET = withErrorHandler(
  async (req: NextRequest, ctx: { params: { id: string; docId: string } }) => {
    const { id, docId } = ctx.params
    const download = req.nextUrl.searchParams.get("download") === "1"
    return respond(await getEmployeeDocumentUrl(id, docId, { download }))
  },
)

export const DELETE = withErrorHandler(
  async (_req: NextRequest, ctx: { params: { id: string; docId: string } }) => {
    const { id, docId } = ctx.params
    return respond(await deleteEmployeeDocument(id, docId))
  },
)
