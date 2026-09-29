import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getStockMatrix, updateStockRegisterRow } from "@/features/stock/server/stock.service"

// GET /api/stock/register?q=&itemId=&unlinked=1&page= - the register pivoted
// like the uploaded sheet: one row per holder+date, one column per item.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  return respond(
    await getStockMatrix({
      q: sp.get("q") ?? undefined,
      itemId: sp.get("itemId") ?? undefined,
      unlinkedOnly: sp.get("unlinked") === "1",
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    }),
  )
})

// PATCH /api/stock/register - write one edited row back (see registerRowSchema).
export const PATCH = withErrorHandler(async (req: NextRequest) =>
  respond(await updateStockRegisterRow(await req.json())),
)
