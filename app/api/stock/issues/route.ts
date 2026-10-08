import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getStockIssues, createStockIssue } from "@/features/stock/server/stock.service"

export const GET = withErrorHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  return respond(
    await getStockIssues({
      q: sp.get("q") ?? undefined,
      itemId: sp.get("itemId") ?? undefined,
      unlinkedOnly: sp.get("unlinked") === "1",
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    }),
  )
})

export const POST = withErrorHandler(async (req: NextRequest) =>
  respond(await createStockIssue(await req.json()), 201),
)
