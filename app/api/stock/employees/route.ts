import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { searchLinkableEmployees } from "@/features/stock/server/stock.service"

// Includes deactivated employees: the person a sheet names may have left.
export const GET = withErrorHandler(async (req: NextRequest) =>
  respond(await searchLinkableEmployees(req.nextUrl.searchParams.get("q") ?? "")),
)
