import { withClientSession, respond } from "@/server/api-handler"
import { deleteClientDocument } from "@/features/client-portal/server/client-documents.service"

// DELETE - withdraw a file the CLIENT uploaded. Narrow by design: a
// staff-published document is not theirs to remove, and an approved upload can
// no longer be withdrawn.
export const DELETE = withClientSession(
  async (_req, { params }: { params: { projectRef: string; fileId: string } }) =>
    respond(await deleteClientDocument(params.projectRef, params.fileId)),
)
