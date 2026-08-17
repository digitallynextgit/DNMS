import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { sendBirthdayWish } from "@/features/noticeboard/server/noticeboard.service"

// Any colleague may send wishes - that is the whole point of the feature.
export const POST = withSession(async (req: NextRequest, _ctx, session) => {
  const { employeeId } = await req.json()
  return respond(await sendBirthdayWish(String(employeeId ?? ""), session))
})
