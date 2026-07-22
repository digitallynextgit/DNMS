import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { aiComplete, isAiConfigured, AiError } from "@/lib/ai"
import type { Session } from "next-auth"

export const runtime = "nodejs"

const SYSTEM_PROMPT = `You are a delivery operations analyst for a project team. You are given real task-throughput data (no names/numbers are invented). Write a short, concrete briefing for a manager.

Rules:
- Use ONLY the data provided. Never invent tasks, names, dates or numbers.
- Be specific: cite people by name and use the actual counts/dates.
- Use these sections, each on its own line, wrapped in bold exactly like **Overall**: **Overall**, **Who's on track**, **Needs attention**, **Urgent this week**, **Suggested actions**.
- Under each section use 1–4 short bullet lines (start each with "- ").
- Keep the whole thing tight (roughly 150–220 words). No preamble, no sign-off.
- Formatting is strict - the UI only renders: plain lines, "- " bullets and **bold**. Do NOT use headings (#), tables, numbered lists or code fences.
- If a section has nothing, write "- Nothing notable." under it.`

// POST /api/projects/performance/report
// Generate an AI briefing over the current task data (same scope as the metrics
// page). Advisory only - nothing is stored.
export const POST = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    if (!isAiConfigured()) {
      return NextResponse.json({ error: "AI is not configured on the server" }, { status: 503 })
    }
    try {
      const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
      const where = isAdmin
        ? {}
        : {
            OR: [
              { team: { managerId: session.user.id } },
              { project: { ownerId: session.user.id } },
              { assigneeId: session.user.id },
            ],
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
          assignee: { select: { firstName: true, lastName: true } },
          project: { select: { name: true } },
        },
      })

      if (tasks.length === 0) {
        return NextResponse.json({ data: { report: "No task data to analyse yet." } })
      }

      const now = new Date()
      const todayStart = new Date(now)
      todayStart.setUTCHours(0, 0, 0, 0)
      const weekStart = new Date(todayStart)
      weekStart.setUTCDate(weekStart.getUTCDate() - ((now.getUTCDay() + 6) % 7))
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
      const dstr = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "no due date")
      const who = (t: (typeof tasks)[number]) =>
        t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "Unassigned"

      // Per-person tallies.
      const per = new Map<
        string,
        { assigned: number; done: number; overdue: number; onHold: number }
      >()
      for (const t of tasks) {
        const k = who(t)
        const p = per.get(k) ?? { assigned: 0, done: 0, overdue: 0, onHold: 0 }
        p.assigned++
        if (t.status === "DONE") p.done++
        else if (t.status === "ON_HOLD") p.onHold++
        else if (t.dueDate && new Date(t.dueDate) < todayStart) p.overdue++
        per.set(k, p)
      }

      const active = (t: (typeof tasks)[number]) => t.status !== "DONE" && t.status !== "DISCARDED"
      const overdue = tasks.filter(
        (t) => active(t) && t.dueDate && new Date(t.dueDate) < todayStart,
      )
      const dueThisWeek = tasks.filter(
        (t) =>
          active(t) &&
          t.dueDate &&
          new Date(t.dueDate) >= todayStart &&
          new Date(t.dueDate) < weekEnd,
      )
      const onHold = tasks.filter((t) => t.status === "ON_HOLD")

      const lines: string[] = []
      lines.push(`As of ${dstr(now)}. Total tasks: ${tasks.length}.`)
      lines.push("")
      lines.push("Per person (assigned / done / overdue / on-hold):")
      for (const [name, p] of [...per.entries()].sort((a, b) => b[1].assigned - a[1].assigned)) {
        lines.push(`- ${name}: ${p.assigned} / ${p.done} / ${p.overdue} / ${p.onHold}`)
      }
      lines.push("")
      lines.push(`Overdue tasks (${overdue.length}):`)
      overdue
        .slice(0, 20)
        .forEach((t) =>
          lines.push(
            `- "${t.title}" — ${who(t)} — was due ${dstr(t.dueDate)} [${t.priority}] on ${t.project?.name ?? "?"}`,
          ),
        )
      lines.push("")
      lines.push(`Due this week (${dueThisWeek.length}):`)
      dueThisWeek
        .slice(0, 20)
        .forEach((t) =>
          lines.push(`- "${t.title}" — ${who(t)} — due ${dstr(t.dueDate)} [${t.priority}]`),
        )
      lines.push("")
      lines.push(`On hold (${onHold.length}):`)
      onHold
        .slice(0, 20)
        .forEach((t) =>
          lines.push(
            `- "${t.title}" — ${who(t)} — reason: ${t.holdReason ?? "n/a"}; expected by ${dstr(t.holdExpectedDate)}`,
          ),
        )

      const report = await aiComplete<string>({
        system: SYSTEM_PROMPT,
        user: lines.join("\n"),
        temperature: 0.3,
        maxTokens: 700,
      })

      return NextResponse.json({ data: { report: report.trim() } })
    } catch (err) {
      console.error("[projects/performance/report]", err)
      return NextResponse.json(
        { error: err instanceof AiError ? err.message : "Couldn't generate the report" },
        { status: 502 },
      )
    }
  },
)
