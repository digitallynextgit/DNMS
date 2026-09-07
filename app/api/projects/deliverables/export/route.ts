import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import { db } from "@/server/db"
import {
  filterWhere,
  quantityByTask,
  scopeWhere,
} from "@/features/projects/server/deliverables.queries"
import {
  DELIVERABLE_STATUS_LABELS,
  STATUS_ORDER,
  splitTaskHours,
  type DeliverableStatus,
} from "@/features/projects/lib/deliverable-lifecycle"
import { toCsv } from "@/lib/export-csv"

// GET /api/projects/deliverables/export?projectId&from&to&status&client=1
//
// The ledger as a file. Two variants of the same rows: the INTERNAL one carries
// hours, notes and who wrote the entry; `client=1` drops all four, because a
// sheet that goes to a client should say what they got, not how long it took us
// or what we said about it internally.
//
// `from` and `to` are REQUIRED, the same rule as the attendance export: every
// filter here is optional, so a bare call would mean "every deliverable ever
// recorded" - one GET able to stall the connection pool. The cap is a year,
// which is what an annual report needs and no more.
export const dynamic = "force-dynamic"

const MAX_RANGE_DAYS = 366
const MS_PER_DAY = 86_400_000
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

const ymd = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : "")
const round2 = (n: number): number => Math.round(n * 100) / 100

function parseStatuses(raw: string | null): DeliverableStatus[] | undefined {
  if (!raw) return undefined
  const list = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is DeliverableStatus => (STATUS_ORDER as string[]).includes(s))
  return list.length ? list : undefined
}

const EXPORT_SELECT = {
  id: true,
  type: true,
  title: true,
  quantity: true,
  status: true,
  startedOn: true,
  completedOn: true,
  dueOn: true,
  revisionCount: true,
  acceptedAt: true,
  verifiedAt: true,
  links: true,
  notes: true,
  taskId: true,
  project: { select: { name: true, code: true } },
  goal: { select: { title: true } },
  team: { select: { name: true } },
  employee: { select: { firstName: true, lastName: true } },
  loggedBy: { select: { firstName: true, lastName: true } },
  acceptedBy: { select: { firstName: true, lastName: true } },
  task: { select: { title: true, loggedHours: true } },
} satisfies Prisma.ProjectDeliverableSelect

const fullName = (p: { firstName: string; lastName: string | null } | null) =>
  p ? `${p.firstName} ${p.lastName ?? ""}`.trim() : ""

export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    const q = req.nextUrl.searchParams
    const from = q.get("from")
    const to = q.get("to")
    const clientSafe = q.get("client") === "1"

    if (!from || !to) {
      return NextResponse.json({ error: "from and to are required" }, { status: 400 })
    }
    if (!DAY_RE.test(from) || !DAY_RE.test(to)) {
      return NextResponse.json({ error: "Dates must look like YYYY-MM-DD" }, { status: 400 })
    }
    const start = new Date(`${from}T00:00:00.000Z`)
    const end = new Date(`${to}T00:00:00.000Z`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
    }
    if (Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1 > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Date range too large - maximum ${MAX_RANGE_DAYS} days` },
        { status: 400 },
      )
    }

    // The URL may carry a slug (that is what the project pages use) but the
    // filter wants an id, and the filename wants the code.
    let projectId: string | undefined
    let label = "all"
    const projectParam = q.get("projectId")
    if (projectParam) {
      const project = await db.project.findFirst({
        where: { OR: [{ id: projectParam }, { slug: projectParam }] },
        select: { id: true, code: true },
      })
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
      projectId = project.id
      label = project.code.replace(/[^a-zA-Z0-9_-]+/g, "-")
    }

    const where: Prisma.ProjectDeliverableWhereInput = {
      AND: [
        scopeWhere(session),
        filterWhere({
          projectId,
          employeeId: q.get("employeeId") ?? undefined,
          teamId: q.get("teamId") ?? undefined,
          type: q.get("type") ?? undefined,
          status: parseStatuses(q.get("status")),
          from,
          to,
        }),
      ],
    }

    // No MAX_ROWS here: a truncated export is a wrong export. The mandatory
    // range is what keeps it bounded.
    const rows = await db.projectDeliverable.findMany({
      where,
      orderBy: [{ completedOn: "asc" }, { createdAt: "asc" }],
      select: EXPORT_SELECT,
    })
    const qtyByTask = await quantityByTask([
      ...new Set(rows.map((r) => r.taskId).filter((t): t is string => !!t)),
    ])

    const header = [
      "Project",
      "Goal",
      "Type",
      "Title",
      "Qty",
      "Status",
      "Due",
      "Started",
      "Completed",
      "Maker",
      "Team",
      "Task",
      "Verified",
      "Accepted on",
      "Accepted by",
      "Revisions",
      "Links",
      ...(clientSafe ? [] : ["Hours", "Hours/unit", "Notes", "Logged by"]),
    ]

    const body = rows.map((r) => {
      const hours =
        r.taskId && r.task
          ? round2(
              splitTaskHours(r.task.loggedHours, r.quantity, qtyByTask.get(r.taskId) ?? r.quantity),
            )
          : null
      return [
        r.project.name,
        r.goal?.title ?? "",
        r.type,
        r.title,
        r.quantity,
        DELIVERABLE_STATUS_LABELS[r.status],
        ymd(r.dueOn),
        ymd(r.startedOn),
        ymd(r.completedOn),
        fullName(r.employee),
        r.team?.name ?? "",
        r.task?.title ?? "",
        r.verifiedAt ? "Yes" : "No",
        r.acceptedAt ? r.acceptedAt.toISOString().slice(0, 10) : "",
        fullName(r.acceptedBy),
        r.revisionCount,
        r.links.join(" | "),
        ...(clientSafe
          ? []
          : [
              hours ?? "",
              hours !== null && r.quantity > 0 ? round2(hours / r.quantity) : "",
              r.notes ?? "",
              fullName(r.loggedBy),
            ]),
      ]
    })

    // The BOM is for Excel: without it a UTF-8 CSV opens as mojibake on
    // Windows, which is where these files are read.
    const csv = `\ufeff${toCsv(body, header)}`
    const filename = `deliverables_${label}_${from}_to_${to}.csv`

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  },
)
