import { withErrorHandler, respond } from "@/server/api-handler"
import { getWfhMailPreview } from "@/features/wfh/server/wfh.service"

// GET /api/wfh/apply/preview
// The envelope for the WFH letter the CURRENT user is about to send: who it's
// addressed to, whether HR is Cc'd, and their signature block. Read-only.
//
// It calls resolveWfhMailEnvelope() through the service - the SAME function the
// send path uses - so the preview can't show a different recipient than we mail.
export const GET = withErrorHandler(async () => respond(await getWfhMailPreview()))
