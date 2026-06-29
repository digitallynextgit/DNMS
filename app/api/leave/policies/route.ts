import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getLeavePolicies, saveLeavePolicies } from "@/features/leave/server/leave-policy.service"

// GET /api/leave/policies - leave types + the full entitlement matrix.
export const GET = withErrorHandler(async () => respond(await getLeavePolicies()))

// PUT /api/leave/policies - upsert a batch of policy cells.
export const PUT = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as {
    entries: Array<{ employmentType: string; leaveTypeId: string; daysPerYear: number | null }>
  }
  return respond(await saveLeavePolicies(body.entries))
})
