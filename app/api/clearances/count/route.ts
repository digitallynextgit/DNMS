import { withSession, respond } from "@/server/api-handler"
import { getMyPendingItemCount } from "@/features/hr-checklists/server/checklists.queries"
import { countMyDueWeeklyReviews } from "@/features/joinee-scorecard/server/weekly-review.service"
import { ok } from "@/server/action-result"

// "Waiting on you" badge: checklist items and sign-offs, plus weekly reviews due from you.
export const GET = withSession(async () => {
  const [items, reviews] = await Promise.all([getMyPendingItemCount(), countMyDueWeeklyReviews()])
  if (!items.ok) return respond(items)
  return respond(ok({ count: items.data.count + reviews }))
})
