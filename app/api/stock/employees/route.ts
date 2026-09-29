import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { searchLinkableEmployees } from "@/features/stock/server/stock.service"

// GET /api/stock/employees?q= - employees for the link dialog. Deliberately
// INCLUDES deactivated employees: the person a sheet names may have left, and
// linking their history is the point.
export const GET = withErrorHandler(async (req: NextRequest) =>
  respond(await searchLinkableEmployees(req.nextUrl.searchParams.get("q") ?? "")),
)
