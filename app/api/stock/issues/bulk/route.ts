import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { bulkStockIssues } from "@/features/stock/server/stock.service"

export const POST = withErrorHandler(async (req: NextRequest) =>
  respond(await bulkStockIssues(await req.json())),
)
