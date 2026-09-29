import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { bulkStockIssues } from "@/features/stock/server/stock.service"

// POST /api/stock/issues/bulk  { ids, action: "link"|"unlink"|"delete", employeeId? }
// One request for the table's selection bar instead of N PATCHes.
export const POST = withErrorHandler(async (req: NextRequest) =>
  respond(await bulkStockIssues(await req.json())),
)
