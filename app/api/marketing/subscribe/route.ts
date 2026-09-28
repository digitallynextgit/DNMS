import { withErrorHandler } from "@/server/api-handler"
import { ok, fail } from "@/lib/api-response"
import { rateLimited, clientIp } from "@/lib/rate-limit"
import { subscribeToNewsletter } from "@/features/marketing/server/newsletter.service"

export const dynamic = "force-dynamic"

// POST /api/marketing/subscribe  { email }
// PUBLIC: newsletter sign-up from the homepage. Rate limited per IP - it was
// the one public write endpoint with no limiter at all, i.e. a free table-fill.
export const POST = withErrorHandler(async (req) => {
  if (rateLimited(`newsletter:${clientIp(req)}`, 5, 60 * 60_000)) {
    return fail("RATE_LIMITED", "Too many sign-ups from this address. Try again later.", 429)
  }
  const body = await req.json().catch(() => ({}))
  return ok(await subscribeToNewsletter(body))
})
