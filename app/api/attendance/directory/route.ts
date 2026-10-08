import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { getAttendanceDirectory } from "@/features/attendance/server/attendance-directory.queries"
import type { Session } from "next-auth"

export const GET = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const sp = req.nextUrl.searchParams
      const result = await getAttendanceDirectory(sp.get("from"), sp.get("to"))
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status ?? 400 })
      }
      return NextResponse.json({ data: result.data })
    } catch (error) {
      console.error("[ATTENDANCE_DIRECTORY]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
