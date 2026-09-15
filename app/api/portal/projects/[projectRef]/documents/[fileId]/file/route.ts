import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { getClientDocumentUrl } from "@/features/client-portal/server/client-documents.service"

// A short-lived signed URL. The bucket is private, so the portal never holds a
// durable link to an asset.
export const GET = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string; fileId: string } }) =>
    respond(
      await getClientDocumentUrl(params.projectRef, params.fileId, {
        download: req.nextUrl.searchParams.get("download") === "1",
      }),
    ),
)
