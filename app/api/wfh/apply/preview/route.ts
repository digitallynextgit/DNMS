import { withErrorHandler, respond } from "@/server/api-handler"
import { getWfhMailPreview } from "@/features/wfh/server/wfh.service"

// Uses resolveWfhMailEnvelope(), like the send path, so the preview can't show a different recipient.
export const GET = withErrorHandler(async () => respond(await getWfhMailPreview()))
