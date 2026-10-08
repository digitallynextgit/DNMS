import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import {
  listClientDocuments,
  uploadClientDocument,
} from "@/features/client-portal/server/client-documents.service"

// Services re-prove the grant and the "documents" module; projectRef is a lookup key, never authorisation.
// A route handler because uploads exceed the 1 MB action body limit.
export const GET = withClientSession(async (_req, { params }: { params: { projectRef: string } }) =>
  respond(await listClientDocuments(params.projectRef)),
)

export const POST = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string } }) =>
    respond(await uploadClientDocument(params.projectRef, await req.formData()), 201),
)
