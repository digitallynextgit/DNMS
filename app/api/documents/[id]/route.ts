import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getDocumentUrl, deleteDocument } from "@/features/documents/server/documents.service"

// GET /api/documents/[id] - short-lived presigned URL (?download=1 forces download).
export const GET = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  const download = req.nextUrl.searchParams.get("download") === "1"
  return respond(await getDocumentUrl(id, { download }))
})

// DELETE /api/documents/[id] - delete a document.
export const DELETE = withErrorHandler(
  async (_req: NextRequest, ctx: { params: { id: string } }) => {
    const { id } = ctx.params
    return respond(await deleteDocument(id))
  },
)
