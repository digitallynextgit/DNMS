import { NextRequest } from "next/server"

import { ok, fail } from "@/lib/api-response"
import { clientIp, rateLimited } from "@/lib/rate-limit"
import { receiveSheetIntakeRow } from "@/features/projects/server/sheet-intake.service"

// A calendar tab's API (e.g. the H2S website form -> BD / Sales Calendar). Public, but every row
// needs the tab's secret; the link and secret come from the tab's ... menu -> API access.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 200_000

export const POST = async (req: NextRequest, ctx: { params: Promise<{ intakeId: string }> }) => {
  const { intakeId } = await ctx.params
  if (rateLimited(`calendar-rows:ip:${clientIp(req)}`, 300) || rateLimited(`calendar-rows:${intakeId}`, 120)) {
    return fail("RATE_LIMITED", "Too many rows at once - slow down and retry", 429)
  }
  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) return fail("TOO_LARGE", "The row is too large", 413)
  let body: unknown
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    return fail("VALIDATION_ERROR", "Send the row as JSON", 422)
  }
  try {
    const result = await receiveSheetIntakeRow(intakeId, req.headers, body)
    if ("data" in result) return ok(result.data, { status: result.status })
    return fail(result.code, result.message, result.status, result.details)
  } catch (error) {
    console.error("[CALENDAR_ROWS]", error)
    return fail("INTERNAL_ERROR", "Something went wrong - retry later", 500)
  }
}
