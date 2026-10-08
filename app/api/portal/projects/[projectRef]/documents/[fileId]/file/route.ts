import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { getClientDocumentUrl } from "@/features/client-portal/server/client-documents.service"

// Short-lived signed URL; the bucket is private.
export const GET = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string; fileId: string } }) =>
    respond(
      await getClientDocumentUrl(params.projectRef, params.fileId, {
        download: req.nextUrl.searchParams.get("download") === "1",
      }),
    ),
)
