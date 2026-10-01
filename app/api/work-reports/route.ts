import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import { workReportQuerySchema } from "@/features/work-reports/schemas/work-report.schema"
import { parseReportMonth } from "@/features/work-reports/lib/report-format"
import {
  narrowPeople,
  resolveWorkReportScope,
} from "@/features/work-reports/server/work-report.scope"
import { buildWorkReport } from "@/features/work-reports/server/work-report.service"
import type { WorkReportFormat } from "@/features/work-reports/types"

// GET /api/work-reports?month=YYYY-MM&employeeIds=a,b&format=pptx|pdf|docx&ai=0|1
//
// The month-end work report as a file download. Who it may cover comes from the
// session: anyone for admin/HR, the caller and their reporting line for a
// manager, only the caller for everyone else. Asking for someone outside that is
// a 403, never a quietly shorter report.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    const q = workReportQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
    const period = parseReportMonth(q.month)
    if (!period) throw new ValidationError("month must be YYYY-MM")
    if (period.from > new Date().toISOString().slice(0, 10)) {
      throw new ValidationError("That month has not started yet")
    }

    const scope = await resolveWorkReportScope(session)
    const employeeIds = narrowPeople(scope, q.employeeIds)
    if (!employeeIds) {
      throw new ForbiddenError(
        q.employeeIds.length
          ? "That includes someone outside what you can report on"
          : "Pick at least one person",
      )
    }

    const report = await buildWorkReport({
      requesterId: session.user.id,
      employeeIds,
      period,
      format: q.format as WorkReportFormat,
      ai: q.ai,
    })
    return new NextResponse(report.bytes, {
      status: 200,
      headers: {
        "Content-Type": report.contentType,
        "Content-Disposition": `attachment; filename="${report.filename}"`,
        "Cache-Control": "no-store",
      },
    })
  },
)
