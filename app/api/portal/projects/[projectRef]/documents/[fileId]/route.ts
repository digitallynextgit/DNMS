import { withClientSession, respond } from "@/server/api-handler"
import { deleteClientDocument } from "@/features/client-portal/server/client-documents.service"

// Only files the client uploaded, and not once approved.
export const DELETE = withClientSession(
  async (_req, { params }: { params: { projectRef: string; fileId: string } }) =>
    respond(await deleteClientDocument(params.projectRef, params.fileId)),
)
