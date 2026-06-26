import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getCompanyDocuments, uploadDocument } from "@/features/documents/server/documents.service"

// GET /api/documents - list company-wide documents (paginated, optional category).
export const GET = withErrorHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const category = sp.get("category") ?? undefined

  const filters: { page?: number; limit?: number } = {}
  if (sp.has("page")) filters.page = Number(sp.get("page"))
  if (sp.has("limit")) filters.limit = Number(sp.get("limit"))

  return respond(await getCompanyDocuments(category, filters))
})

// POST /api/documents - upload a document (multipart FormData).
export const POST = withErrorHandler(async (req: NextRequest) => {
  const formData = await req.formData()
  return respond(await uploadDocument(formData))
})
