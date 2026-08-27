import { withErrorHandler } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { subscribeToNewsletter } from "@/features/marketing/server/newsletter.service"

export const dynamic = "force-dynamic"

// POST /api/marketing/subscribe  { email }
// PUBLIC: newsletter sign-up from the homepage.
export const POST = withErrorHandler(async (req) => {
  const body = await req.json().catch(() => ({}))
  return ok(await subscribeToNewsletter(body))
})
