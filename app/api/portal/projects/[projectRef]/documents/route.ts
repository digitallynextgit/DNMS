import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import {
  listClientDocuments,
  uploadClientDocument,
} from "@/features/client-portal/server/client-documents.service"

// GET  /api/portal/projects/:projectRef/documents - the shared library
// POST /api/portal/projects/:projectRef/documents - the client uploads a file
//
// Both services re-prove the grant AND the "documents" module, and every query
// filters on isClientVisible - the projectRef is a lookup key, never an
// authorisation. A Route Handler rather than a server action because uploads
// exceed the 1 MB action body limit.
export const GET = withClientSession(async (_req, { params }: { params: { projectRef: string } }) =>
  respond(await listClientDocuments(params.projectRef)),
)

export const POST = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string } }) =>
    respond(await uploadClientDocument(params.projectRef, await req.formData()), 201),
)
