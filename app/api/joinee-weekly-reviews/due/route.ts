import { withErrorHandler, respond } from "@/server/api-handler"
import { listMyDueWeeklyReviews } from "@/features/joinee-scorecard/server/weekly-review.service"

// The signed-in reporting manager's weekly reviews still to fill in ("Waiting on you").
export const GET = withErrorHandler(async () => respond(await listMyDueWeeklyReviews()))
