import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { aiComplete, isAiConfigured, AiError } from "@/lib/ai"
import {
  DEFAULT_SECTIONS,
  reportSection,
  reportType,
  sectionsFor,
  type ReportSection,
  type ReportType,
} from "@/features/projects/lib/report-options"
import type { Session } from "next-auth"

export const runtime = "nodejs"

/**
 * The prompt is assembled per request rather than fixed, because the caller
 * chooses the report type and the sections. Only the invariants live here - the
 * section list and the analytical lens are appended from the request.
 */
function buildSystemPrompt(type: ReportType, sections: ReportSection[]): string {
  const def = reportType(type)
  const chosen = sections
    .map((key) => reportSection(key))
    .filter((s): s is NonNullable<typeof s> => !!s)

  const headings = chosen.map((s) => `**${s.heading}**`).join(", ")
  const rules = chosen.map((s) => `- **${s.heading}**: ${s.instruction}`).join("\n")

  // Roughly 45 words a section, floored so a one-section report is still useful.
  const words = Math.max(90, chosen.length * 45)

  return `You are a delivery operations analyst for a project team. You are given real task-throughput data (no names/numbers are invented). Write a short, concrete briefing for a manager.

REPORT TYPE: ${def.label}. ${def.lens}

Rules:
- Use ONLY the data provided. Never invent tasks, names, dates or numbers.
- Be specific: cite people, teams and projects by name and use the actual counts/dates.
- Use EXACTLY these sections, in this order, each on its own line, wrapped in bold exactly like **Overall**: ${headings}.
- Do not add any section that is not in that list, and do not omit one that is.
- Under each section use 1 to 4 short bullet lines (start each with "- ").
- Keep the whole thing to roughly ${words} to ${words + 80} words. No preamble, no sign-off.
- Formatting is strict - the UI only renders: plain lines, "- " bullets and **bold**. Do NOT use headings (#), tables, numbered lists or code fences.
- If a section has nothing to report, write "- Nothing notable." under it.
- The first line of the data states the SCOPE (which projects, teams, people and dates). Everything you write must be about that slice only, and you must not imply it covers more than it does.

What each section must contain:
${rules}`
}

// POST /api/projects/performance/report
// Generate an AI briefing. The caller picks the report type, the scope (which
// projects / teams / people) and which sections it contains; the date window
// comes from the page filter. Advisory only - nothing is stored.
export const POST = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    if (!isAiConfigured()) {
      return NextResponse.json({ error: "AI is not configured on the server" }, { status: 503 })
    }
    try {
      const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
      const scopeWhere = isAdmin
        ? {}
        : {
            OR: [
              { team: { managerId: session.user.id } },
              { project: { ownerId: session.user.id } },
              { assigneeId: session.user.id },
            ],
          }

      const body = await req.json().catch(() => ({}))

      // Everything from the client is untrusted: the type and sections are
      // snapped to the known vocabulary so a hand-rolled body cannot inject
      // instructions into the prompt.
      const type: ReportType = reportType(body?.type).key
      const allowed = new Set(sectionsFor(type).map((s) => s.key))
      const asIds = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 50) : []

      const requested = asIds(body?.sections) as ReportSection[]
      const sections = sectionsFor(type)
        .map((s) => s.key)
        .filter((k) =>
          requested.length > 0 ? requested.includes(k) : DEFAULT_SECTIONS.includes(k),
        )
      const active = sections.length > 0 ? sections : DEFAULT_SECTIONS.filter((s) => allowed.has(s))

      const def = reportType(type)
      const projectIds = def.scopes.includes("projects") ? asIds(body?.projectIds) : []
      const teamIds = def.scopes.includes("teams") ? asIds(body?.teamIds) : []
      const employeeIds = def.scopes.includes("people") ? asIds(body?.employeeIds) : []

      const from: string | undefined = body?.from || undefined
      const to: string | undefined = body?.to || undefined

      const dueRange =
        from || to
          ? {
              dueDate: {
                ...(from && { gte: new Date(`${from}T00:00:00.000Z`) }),
                ...(to && { lte: new Date(`${to}T23:59:59.999Z`) }),
              },
            }
          : {}

      // Filters compose INSIDE the scope clause, so they can only ever narrow
      // what this user was already allowed to see.
      const where = {
        AND: [
          scopeWhere,
          ...(projectIds.length > 0 ? [{ projectId: { in: projectIds } }] : []),
          ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
          ...(employeeIds.length > 0 ? [{ assigneeId: { in: employeeIds } }] : []),
          dueRange,
        ].filter((c) => Object.keys(c).length > 0),
      }

      const tasks = await db.projectTask.findMany({
        where,
        select: {
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
          holdReason: true,
          holdExpectedDate: true,
          estimatedHours: true,
          loggedHours: true,
          assignee: { select: { firstName: true, lastName: true } },
          team: { select: { name: true } },
          project: { select: { name: true } },
        },
      })

      if (tasks.length === 0) {
        const narrowed = projectIds.length + teamIds.length + employeeIds.length > 0 || from || to
        return NextResponse.json({
          data: {
            report: narrowed
              ? "No tasks match the selected scope, so there is nothing to brief on. Widen the date range, or clear a filter in Report options."
              : "No task data to analyse yet.",
          },
        })
      }

      // Name the scope in the prompt. Without it the model describes a filtered
      // slice as though it were the whole portfolio.
      const [projectNames, teamNames, peopleNames] = await Promise.all([
        projectIds.length > 0
          ? db.project.findMany({ where: { id: { in: projectIds } }, select: { name: true } })
          : Promise.resolve([]),
        teamIds.length > 0
          ? db.projectTeam.findMany({ where: { id: { in: teamIds } }, select: { name: true } })
          : Promise.resolve([]),
        employeeIds.length > 0
          ? db.employee.findMany({
              where: { id: { in: employeeIds } },
              select: { firstName: true, lastName: true },
            })
          : Promise.resolve([]),
      ])

      const scopeLine = [
        projectNames.length > 0
          ? `Projects: ${projectNames.map((p) => p.name).join(", ")}.`
          : "Projects: all in scope.",
        teamNames.length > 0 ? `Teams: ${teamNames.map((t) => t.name).join(", ")}.` : null,
        peopleNames.length > 0
          ? `People: ${peopleNames.map((p) => `${p.firstName} ${p.lastName}`.trim()).join(", ")}.`
          : null,
        from || to ? `Only tasks DUE between ${from ?? "any"} and ${to ?? "any"}.` : "All dates.",
      ]
        .filter(Boolean)
        .join(" ")

      const now = new Date()
      const todayStart = new Date(now)
      todayStart.setUTCHours(0, 0, 0, 0)
      const weekEnd = new Date(todayStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
      const dstr = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "no due date")
      const who = (t: (typeof tasks)[number]) =>
        t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}`.trim() : "Unassigned"

      // The grouping dimension IS the report type - a team report that tallies
      // per person answers the wrong question.
      const groupKey = (t: (typeof tasks)[number]): string => {
        switch (def.groupBy) {
          case "project":
            return t.project?.name ?? "No project"
          case "team":
            return t.team?.name ?? "No team"
          case "employee":
            return who(t)
          default:
            return "All"
        }
      }
      const groupLabel = { project: "project", team: "team", employee: "person", none: "group" }[
        def.groupBy
      ]

      interface Tally {
        assigned: number
        done: number
        onTime: number
        late: number
        overdue: number
        onHold: number
        estimated: number
        logged: number
      }
      const zero = (): Tally => ({
        assigned: 0,
        done: 0,
        onTime: 0,
        late: 0,
        overdue: 0,
        onHold: 0,
        estimated: 0,
        logged: 0,
      })

      const isDone = (t: (typeof tasks)[number]) => t.status === "DONE"
      const isActive = (t: (typeof tasks)[number]) =>
        t.status !== "DONE" && t.status !== "DISCARDED"
      const wasOnTime = (t: (typeof tasks)[number]) => {
        if (!t.dueDate || !t.completedAt) return true
        const dueEnd = new Date(t.dueDate)
        dueEnd.setUTCHours(23, 59, 59, 999)
        return t.completedAt <= dueEnd
      }

      const tally = (acc: Tally, t: (typeof tasks)[number]) => {
        acc.assigned++
        acc.estimated += t.estimatedHours ?? 0
        acc.logged += t.loggedHours ?? 0
        if (isDone(t)) {
          acc.done++
          if (wasOnTime(t)) acc.onTime++
          else acc.late++
        } else if (t.status === "ON_HOLD") acc.onHold++
        else if (isActive(t) && t.dueDate && new Date(t.dueDate) < todayStart) acc.overdue++
      }

      const groups = new Map<string, Tally>()
      const totals = zero()
      for (const t of tasks) {
        tally(totals, t)
        const k = groupKey(t)
        const g = groups.get(k) ?? zero()
        tally(g, t)
        groups.set(k, g)
      }

      const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "n/a")
      const hrs = (n: number) => (n > 0 ? `${Math.round(n * 10) / 10}h` : "0h")

      const lines: string[] = []
      lines.push(scopeLine)
      lines.push(
        `As of ${dstr(now)}. Total tasks in scope: ${tasks.length}. Completed: ${totals.done} (${pct(totals.done, totals.assigned)}). On time: ${totals.onTime}/${totals.done} (${pct(totals.onTime, totals.done)}). Overdue: ${totals.overdue}. On hold: ${totals.onHold}.`,
      )
      lines.push("")

      lines.push(`Per ${groupLabel} (assigned / done / on-time / late / overdue / on-hold):`)
      for (const [name, g] of [...groups.entries()].sort((a, b) => b[1].assigned - a[1].assigned)) {
        lines.push(
          `- ${name}: ${g.assigned} / ${g.done} / ${g.onTime} / ${g.late} / ${g.overdue} / ${g.onHold} (completion ${pct(g.done, g.assigned)}, on-time ${pct(g.onTime, g.done)})`,
        )
      }

      // Detail blocks cost prompt tokens, so each one is only sent when a
      // section that needs it was actually requested.
      const push = (title: string, rows: string[]) => {
        lines.push("")
        lines.push(`${title} (${rows.length}):`)
        if (rows.length === 0) lines.push("- none")
        else rows.slice(0, 25).forEach((r) => lines.push(r))
        if (rows.length > 25) lines.push(`- …and ${rows.length - 25} more`)
      }

      if (active.includes("urgent") || active.includes("attention")) {
        push(
          "Overdue tasks",
          tasks
            .filter((t) => isActive(t) && t.dueDate && new Date(t.dueDate) < todayStart)
            .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
            .map(
              (t) =>
                `- "${t.title}" - ${who(t)} - was due ${dstr(t.dueDate)} [${t.priority}] on ${t.project?.name ?? "?"}${t.team ? ` / ${t.team.name}` : ""}`,
            ),
        )
      }

      if (active.includes("urgent")) {
        push(
          "Due in the next 7 days",
          tasks
            .filter(
              (t) =>
                isActive(t) &&
                t.dueDate &&
                new Date(t.dueDate) >= todayStart &&
                new Date(t.dueDate) < weekEnd,
            )
            .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
            .map((t) => `- "${t.title}" - ${who(t)} - due ${dstr(t.dueDate)} [${t.priority}]`),
        )
      }

      if (active.includes("blockers")) {
        push(
          "On hold",
          tasks
            .filter((t) => t.status === "ON_HOLD")
            .map(
              (t) =>
                `- "${t.title}" - ${who(t)} - reason: ${t.holdReason ?? "none given"}; expected by ${dstr(t.holdExpectedDate)}`,
            ),
        )
      }

      if (active.includes("quality")) {
        push(
          "Completed late",
          tasks
            .filter((t) => isDone(t) && !wasOnTime(t))
            .map(
              (t) =>
                `- "${t.title}" - ${who(t)} - due ${dstr(t.dueDate)}, completed ${dstr(t.completedAt)}`,
            ),
        )
      }

      if (active.includes("workload")) {
        lines.push("")
        lines.push(`Workload per ${groupLabel} (open tasks, estimated hours, logged hours):`)
        for (const [name, g] of [...groups.entries()].sort(
          (a, b) => b[1].assigned - b[1].done - (a[1].assigned - a[1].done),
        )) {
          lines.push(
            `- ${name}: ${g.assigned - g.done} open, ${hrs(g.estimated)} estimated, ${hrs(g.logged)} logged`,
          )
        }
      }

      const report = await aiComplete<string>({
        system: buildSystemPrompt(type, active),
        user: lines.join("\n"),
        temperature: 0.3,
        // Longer reports need room; the cap scales with the section count.
        maxTokens: Math.min(1600, 300 + active.length * 160),
        // This is the longest prompt in the app and asks for the most tokens back;
        // it measures 8-12s, which leaves no room under the 20s default.
        timeoutMs: 35_000,
      })

      return NextResponse.json({ data: { report: report.trim() } })
    } catch (err) {
      console.error("[projects/performance/report]", err)
      // Forward the provider's status: a 429 is "try again", not "this broke".
      return NextResponse.json(
        { error: err instanceof AiError ? err.message : "Couldn't generate the report" },
        { status: err instanceof AiError ? (err.status ?? 502) : 502 },
      )
    }
  },
)
