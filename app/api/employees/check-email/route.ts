import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { checkEmailAvailability } from "@/features/employees/server/employees.service"

// GET /api/employees/check-email?email=...&excludeId=... - live availability check.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const email = sp.get("email") ?? ""
  const excludeId = sp.get("excludeId") ?? undefined
  return respond(await checkEmailAvailability(email, excludeId))
})
