import "server-only"

import { createHash } from "node:crypto"
import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { AI_MODEL_SMART, aiComplete } from "@/lib/ai"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { addDays, todayUtc } from "@/lib/dates"
import { isProjectService, serviceInfo, serviceTeams } from "../lib/project-services"
import { goalVerdict, mainGoalVerdict, type GoalVerdict } from "../lib/goal-accountability"
import { sheetTable } from "../lib/sheet-export"
import { canManageProject } from "./project-access"
import { getDeliverableTasks } from "./deliverable-tasks.service"
import { getProjectGoals } from "./goals.service"
import { getSeriesHistory } from "./goal-metrics.service"
import { getWorkbook } from "./sheets.service"

// AI that drafts planning: how to split a number across services, what work a part needs, how to
// split a deliverable into tasks, why a goal stands where it does, and what a calendar holds. It
// only drafts - people edit and save through the normal forms. No names of people are sent.

export type SuggestionKind = "goal_split" | "deliverables" | "tasks" | "explain_goal" | "calendar"

const SYSTEM = [
  "You help a digital marketing agency plan client work in its project tool.",
  "Be specific and practical, in plain English a busy account manager reads in seconds.",
  "Use hyphens, never em dashes. No markdown. Reply with JSON only, exactly the shape asked for.",
  "Never invent people, numbers you were not given, or teams that are not listed.",
].join(" ")

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN")
const clip = (s: string | null | undefined, n: number) =>
  s ? s.replace(/\s+/g, " ").trim().slice(0, n) : ""
const str = (v: unknown, n: number) => (typeof v === "string" ? clip(v, n) : "")
const int = (v: unknown, min: number, max: number) => {
  const x = Math.round(Number(v))
  return Number.isFinite(x) && x >= min && x <= max ? x : null
}

async function projectContext(projectId: string): Promise<{ text: string; ownerId: string }> {
  const p = await db.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      description: true,
      services: true,
      ownerId: true,
      client: { select: { industry: true } },
      brand: { select: { brief: true } },
    },
  })
  if (!p) throw new NotFoundError("Project")
  const services = p.services.filter(isProjectService).map((c) => `${c} (${serviceInfo(c)?.name})`)
  return {
    ownerId: p.ownerId,
    text: [
      `Project: ${p.name}${p.description ? ` - ${clip(p.description, 300)}` : ""}`,
      p.client?.industry ? `Industry: ${p.client.industry}` : null,
      `Services: ${services.join(", ") || "none listed"}`,
      p.brand?.brief ? `Brand brief (excerpt): ${clip(p.brand.brief, 1500)}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  }
}

async function record(
  projectId: string,
  kind: SuggestionKind,
  input: unknown,
  output: unknown,
  requestedById: string,
): Promise<string> {
  const row = await db.projectAiSuggestion.create({
    data: {
      projectId,
      kind,
      input: input as Prisma.InputJsonValue,
      output: output as Prisma.InputJsonValue,
      requestedById,
    },
    select: { id: true },
  })
  return row.id
}

/** A person used the suggestion (filled a form from it). Saving still goes through the normal APIs. */
export async function acceptSuggestion(
  projectId: string,
  suggestionId: string,
  actorId: string,
): Promise<void> {
  const row = await db.projectAiSuggestion.findFirst({
    where: { id: suggestionId, projectId },
    select: { id: true, acceptedAt: true },
  })
  if (!row) throw new NotFoundError("Suggestion")
  if (row.acceptedAt) return
  await db.projectAiSuggestion.update({
    where: { id: row.id },
    data: { acceptedById: actorId, acceptedAt: new Date() },
  })
}

async function requireManager(session: Session, projectId: string) {
  if (!(await canManageProject(session, projectId))) {
    throw new ForbiddenError("Only the account manager can plan this.")
  }
}

// --- 1. Splitting a number across services (and proposing next month's) -----------------------

export interface GoalSplitSuggestion {
  id: string
  total: number
  parts: { service: string; target: number; reason: string }[]
  reason: string
}

/** Parts scaled to add up to the total exactly; the remainder goes on the biggest part. */
function scaleTo(parts: { service: string; target: number; reason: string }[], total: number) {
  const sum = parts.reduce((s, p) => s + p.target, 0)
  if (sum <= 0 || sum === total) return parts
  const scaled = parts.map((p) => ({
    ...p,
    target: Math.max(1, Math.round((p.target / sum) * total)),
  }))
  const diff = total - scaled.reduce((s, p) => s + p.target, 0)
  const biggest = scaled.reduce((a, b) => (b.target > a.target ? b : a))
  biggest.target = Math.max(1, biggest.target + diff)
  return scaled
}

export async function suggestGoalSplit(
  session: Session,
  projectId: string,
  input: { metricLabel?: unknown; targetValue?: unknown; services?: unknown; seriesId?: unknown },
): Promise<GoalSplitSuggestion> {
  await requireManager(session, projectId)
  const ctx = await projectContext(projectId)
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { services: true },
  })
  const offered = Array.isArray(input.services) ? input.services.filter(isProjectService) : []
  const services = (offered.length ? offered : (project?.services ?? [])).filter(isProjectService)
  if (services.length === 0) throw new ValidationError("Tick the project's services first.")
  const seriesId = typeof input.seriesId === "string" ? input.seriesId : null
  const given = int(input.targetValue, 1, 1_000_000_000)
  let metric = str(input.metricLabel, 40)

  // The months so far, newest last: what was asked of each service and what it reached.
  let history = ""
  if (seriesId) {
    const h = await getSeriesHistory(projectId, seriesId)
    metric = metric || h.metricLabel || "results"
    history = h.months
      .slice(-3)
      .map(
        (m) =>
          `${m.month}: target ${fmt(m.targetValue ?? 0)}, reached ${fmt(m.actualValue ?? 0)}; ` +
          m.parts
            .map(
              (p) =>
                `${p.service ?? p.title} ${fmt(p.actualValue ?? 0)}/${fmt(p.targetValue ?? 0)}`,
            )
            .join(", "),
      )
      .join("\n")
  }
  if (!metric) throw new ValidationError("Say what is counted first (e.g. Orders).")

  const user = [
    ctx.text,
    "",
    `Goal: ${given ? fmt(given) : "a monthly number of"} ${metric} this month.`,
    `Split it across these services: ${services.map((c) => `${c} (${serviceInfo(c)?.name})`).join(", ")}.`,
    history ? `Past months (target vs reached per service):\n${history}` : "No past months yet.",
    "",
    given
      ? `Return {"total": ${given}, "parts": [{"service": code, "target": whole number, "reason": one short sentence}], "reason": one sentence on the split}. The parts must add up to the total. Leave out a service only if it cannot move this number.`
      : 'Propose next month\'s total from the trend, then split it. Return {"total": whole number, "parts": [{"service": code, "target": whole number, "reason": one short sentence}], "reason": one or two sentences on the total and the split}.',
  ].join("\n")

  const out = await aiComplete<{ total?: unknown; parts?: unknown; reason?: unknown }>({
    system: SYSTEM,
    user,
    model: AI_MODEL_SMART,
    json: true,
    maxTokens: 900,
    temperature: 0.2,
    timeoutMs: 60_000,
  })
  const total = given ?? int(out.total, 1, 1_000_000_000)
  if (!total) throw new ValidationError("The AI did not propose a number - try again.")
  const raw = Array.isArray(out.parts) ? out.parts : []
  const seen = new Set<string>()
  const parts = raw.flatMap((p) => {
    const o = (p ?? {}) as Record<string, unknown>
    const service = typeof o.service === "string" ? o.service.toUpperCase() : ""
    const target = int(o.target, 1, 1_000_000_000)
    if (!services.includes(service as never) || !target || seen.has(service)) return []
    seen.add(service)
    return [{ service, target, reason: str(o.reason, 200) }]
  })
  if (parts.length === 0)
    throw new ValidationError("The AI did not return a usable split - try again.")
  const result = { total, parts: scaleTo(parts, total), reason: str(out.reason, 400) }
  const id = await record(
    projectId,
    "goal_split",
    { metric, total: given, services, seriesId },
    result,
    session.user.id,
  )
  return { id, ...result }
}

// --- 2. The work a goal (or a service part) needs -------------------------------------------------

export interface DeliverablesSuggestion {
  id: string
  lines: {
    teamId: string
    teamName: string
    type: string
    title: string
    quantity: number
    reason: string
  }[]
}

export async function suggestDeliverables(
  session: Session,
  projectId: string,
  goalId: string,
): Promise<DeliverablesSuggestion> {
  await requireManager(session, projectId)
  const ctx = await projectContext(projectId)
  const goal = await db.projectGoal.findFirst({
    where: { id: goalId, projectId },
    select: {
      title: true,
      metricLabel: true,
      targetValue: true,
      service: true,
      seriesId: true,
      periodStart: true,
      periodEnd: true,
      targetDate: true,
      parent: { select: { title: true } },
    },
  })
  if (!goal) throw new NotFoundError("Goal")
  const teams = await db.projectTeam.findMany({
    where: { projectId },
    select: { id: true, name: true },
  })
  const usual = serviceTeams(goal.service)

  // What this project has made in the last 90 days, by type - so suggestions use its own words.
  const since = addDays(todayUtc(), -90)
  const made = await db.projectDeliverable.groupBy({
    by: ["type"],
    where: { projectId, completedOn: { gte: since }, status: { in: ["DELIVERED", "ACCEPTED"] } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 15,
  })
  // Last month's plan for the same part, when this goal repeats.
  let lastPlan = ""
  if (goal.seriesId && goal.periodStart) {
    const prev = await db.projectGoal.findFirst({
      where: {
        seriesId: goal.seriesId,
        service: goal.service,
        periodStart: { lt: goal.periodStart },
        ...(goal.service ? {} : { parentId: null }),
      },
      orderBy: { periodStart: "desc" },
      select: { id: true },
    })
    if (prev) {
      const rows = await db.projectDeliverable.findMany({
        where: { goalId: prev.id, status: { not: "DISCARDED" } },
        select: {
          type: true,
          title: true,
          quantity: true,
          deliveredQuantity: true,
          team: { select: { name: true } },
        },
        take: 30,
      })
      lastPlan = rows
        .map(
          (r) =>
            `${r.team?.name ?? "no team"}: ${r.quantity} x ${r.type} "${clip(r.title, 60)}" (${r.deliveredQuantity} made)`,
        )
        .join("\n")
    }
  }

  const window = goal.periodStart
    ? `${goal.periodStart.toISOString().slice(0, 10)} to ${goal.periodEnd?.toISOString().slice(0, 10)}`
    : goal.targetDate
      ? `by ${goal.targetDate.toISOString().slice(0, 10)}`
      : "no date"
  const user = [
    ctx.text,
    "",
    `Goal: ${goal.parent ? `${goal.parent.title} > ` : ""}${goal.title}` +
      (goal.targetValue ? ` - ${fmt(goal.targetValue)} ${goal.metricLabel ?? ""}` : "") +
      (goal.service ? ` (service ${goal.service}, ${serviceInfo(goal.service)?.name})` : "") +
      `, ${window}.`,
    `Teams on the project: ${teams.map((t) => t.name).join(", ")}.`,
    usual.length ? `Teams that usually do this service's work: ${usual.join(", ")}.` : null,
    made.length
      ? `Deliverable types this project made in the last 90 days: ${made.map((m) => `${m.type} (${m._sum.quantity ?? 0})`).join(", ")}.`
      : null,
    lastPlan ? `Last month's plan for this part:\n${lastPlan}` : null,
    "",
    'Plan the work for this goal. Return {"lines": [{"team": a team name from the list, "type": short type like "Reel" or "Blog", "title": what it is, "quantity": whole number, "reason": one short sentence}]} with 3 to 10 lines. Prefer the project\'s own types. Quantities should be realistic for the window.',
  ]
    .filter(Boolean)
    .join("\n")

  const out = await aiComplete<{ lines?: unknown }>({
    system: SYSTEM,
    user,
    model: AI_MODEL_SMART,
    json: true,
    maxTokens: 1200,
    temperature: 0.3,
    timeoutMs: 60_000,
  })
  const byName = new Map(teams.map((t) => [t.name.toUpperCase(), t]))
  const lines = (Array.isArray(out.lines) ? out.lines : []).flatMap((l) => {
    const o = (l ?? {}) as Record<string, unknown>
    const team = byName.get(String(o.team ?? "").toUpperCase())
    const type = str(o.type, 40)
    const title = str(o.title, 120)
    const quantity = int(o.quantity, 1, 200)
    if (!team || !type || !title || !quantity) return []
    return [
      { teamId: team.id, teamName: team.name, type, title, quantity, reason: str(o.reason, 200) },
    ]
  })
  if (lines.length === 0)
    throw new ValidationError("The AI did not return usable work - try again.")
  const result = { lines: lines.slice(0, 12) }
  const id = await record(projectId, "deliverables", { goalId }, result, session.user.id)
  return { id, ...result }
}

// --- 3. Splitting a deliverable into tasks ---------------------------------------------------------

export interface TasksSuggestion {
  id: string
  tasks: { title: string; estimatedHours: number | null; logHint: string }[]
}

export async function suggestTasks(
  session: Session,
  projectId: string,
  deliverableId: string,
): Promise<TasksSuggestion> {
  const access = await getDeliverableTasks(session, projectId, deliverableId)
  if (!access.canSplit)
    throw new ForbiddenError("Only the team that owes this, or its managers, can split it.")
  const ctx = await projectContext(projectId)
  const d = await db.projectDeliverable.findFirst({
    where: { id: deliverableId, projectId },
    select: {
      type: true,
      title: true,
      quantity: true,
      notes: true,
      dueOn: true,
      team: { select: { name: true } },
      goal: { select: { title: true, metricLabel: true, targetValue: true } },
    },
  })
  if (!d) throw new NotFoundError("Deliverable")
  const user = [
    ctx.text,
    "",
    `Deliverable: ${d.quantity} x ${d.type} "${d.title}" for the ${d.team?.name ?? ""} team` +
      (d.dueOn ? `, due ${d.dueOn.toISOString().slice(0, 10)}` : "") +
      (d.goal
        ? `, towards the goal "${d.goal.title}"${d.goal.targetValue ? ` (${fmt(d.goal.targetValue)} ${d.goal.metricLabel ?? ""})` : ""}`
        : "") +
      ".",
    d.notes ? `Notes: ${clip(d.notes, 400)}` : null,
    access.tasks.length
      ? `Tasks it already has: ${access.tasks.map((t) => t.title).join("; ")}.`
      : null,
    "",
    'Break it into 2 to 8 tasks one person can each finish. Return {"tasks": [{"title": short task title, "estimatedHours": number, "logHint": what the person should write in the work log when done, e.g. "link to the 4 approved banners"}]}. Don\'t repeat tasks it already has.',
  ]
    .filter(Boolean)
    .join("\n")
  const out = await aiComplete<{ tasks?: unknown }>({
    system: SYSTEM,
    user,
    model: AI_MODEL_SMART,
    json: true,
    maxTokens: 900,
    temperature: 0.3,
    timeoutMs: 60_000,
  })
  const tasks = (Array.isArray(out.tasks) ? out.tasks : []).flatMap((t) => {
    const o = (t ?? {}) as Record<string, unknown>
    const title = str(o.title, 200)
    if (!title) return []
    const h = Number(o.estimatedHours)
    return [
      {
        title,
        estimatedHours: Number.isFinite(h) && h > 0 && h <= 200 ? Math.round(h * 2) / 2 : null,
        logHint: str(o.logHint, 200),
      },
    ]
  })
  if (tasks.length === 0)
    throw new ValidationError("The AI did not return usable tasks - try again.")
  const result = { tasks: tasks.slice(0, 8) }
  const id = await record(projectId, "tasks", { deliverableId }, result, session.user.id)
  return { id, ...result }
}

// --- 4. Why a goal stands where it does ------------------------------------------------------------

/** The verdict without names: who answers for it is described by role. */
function anonymous(v: GoalVerdict): unknown {
  return {
    verdict: v.label,
    summary: v.summary,
    answersForIt: v.responsible.map((r) => r.why),
    items: v.items.map((i) => ({ kind: i.kind, title: i.title })),
    parts: v.parts?.map((p) => ({
      part: p.title,
      verdict: p.verdict.label,
      summary: p.verdict.summary,
    })),
  }
}

export async function explainGoal(
  session: Session,
  projectId: string,
  goalId: string,
): Promise<{ id: string; text: string; verdict: GoalVerdict }> {
  const g = await db.projectGoal.findFirst({
    where: { id: goalId, projectId },
    select: { periodStart: true, parentId: true },
  })
  if (!g) throw new NotFoundError("Goal")
  const summary = await getProjectGoals(projectId, false, g.periodStart?.toISOString().slice(0, 7))
  const all = summary.goals.flatMap((x) => [x, ...x.children])
  const node = all.find((x) => x.id === goalId)
  if (!node) throw new NotFoundError("Goal")
  const owner = await db.project.findUnique({
    where: { id: projectId },
    select: { owner: { select: { firstName: true, lastName: true } } },
  })
  const amName = owner?.owner
    ? `${owner.owner.firstName} ${owner.owner.lastName ?? ""}`.trim()
    : null
  const plans = summary.plans ?? {}
  const today = todayUtc()
  const verdict = g.parentId
    ? goalVerdict({ goal: node, plan: plans[node.id], amName, today })
    : mainGoalVerdict(node, plans, amName, today)
  if (!verdict) throw new ValidationError("Only a goal with a number has a verdict to explain.")

  const user = [
    `Goal: ${node.title}` +
      (node.targetValue !== null
        ? ` - ${fmt(node.actualValue ?? 0)} of ${fmt(node.targetValue)} ${node.metricLabel ?? ""}`
        : "") +
      (node.paceValue !== null ? `, ${fmt(node.paceValue)} expected by now` : "") +
      ".",
    `The verdict, worked out by fixed rules: ${JSON.stringify(anonymous(verdict))}`,
    "",
    'Explain it to the account manager in 2 to 4 short sentences, then give the single most useful next step. Don\'t change the verdict. Return {"text": "..."}.',
  ].join("\n")
  const out = await aiComplete<{ text?: unknown }>({
    system: SYSTEM,
    user,
    model: AI_MODEL_SMART,
    json: true,
    maxTokens: 400,
    temperature: 0.2,
    timeoutMs: 45_000,
  })
  const text = str(out.text, 900)
  if (!text) throw new ValidationError("The AI did not return an explanation - try again.")
  const id = await record(projectId, "explain_goal", { goalId }, { text }, session.user.id)
  return { id, text, verdict }
}

// --- 5. What a calendar holds (cached until it changes) --------------------------------------------

export interface CalendarSummary {
  headline: string
  counts: { label: string; value: string }[]
  upcoming: string[]
  gaps: string[]
}

const MAX_ROWS_PER_TAB = 150
const MAX_CELL = 120
const MAX_CHARS = 24_000

export async function summariseCalendar(
  projectId: string,
  workbookId: string,
  refresh = false,
): Promise<{ summary: CalendarSummary; generatedAt: string; cached: boolean }> {
  const book = await getWorkbook(projectId, workbookId)
  if (!book) throw new NotFoundError("Calendar")
  // People cells read as "a person": names are not needed to summarise the plan.
  const tables = book.sheets.map((s) => {
    const t = sheetTable(s, () => "a person")
    return {
      tab: t.name,
      header: t.header,
      rows: t.rows
        .slice(0, MAX_ROWS_PER_TAB)
        .map((r) => r.map((v) => (v === null ? "" : clip(String(v), MAX_CELL)))),
      totalRows: t.rows.length,
    }
  })
  const plan = book.teams.map((t) => ({
    team: t.teamName,
    status: t.status,
    quantity: t.quantity,
    dueOn: t.dueOn,
  }))
  const hash = createHash("sha256").update(JSON.stringify({ tables, plan })).digest("hex")

  const cached = await db.projectWorkbookSummary.findUnique({ where: { workbookId } })
  if (cached && cached.contentHash === hash && !refresh) {
    return {
      summary: cached.summary as unknown as CalendarSummary,
      generatedAt: cached.generatedAt.toISOString(),
      cached: true,
    }
  }
  const rowCount = tables.reduce((s, t) => s + t.totalRows, 0)
  if (rowCount === 0)
    throw new ValidationError("This calendar has no rows yet - nothing to summarise.")

  let body = JSON.stringify({ calendar: book.name, month: book.periodMonth, plan, tables })
  if (body.length > MAX_CHARS) body = `${body.slice(0, MAX_CHARS)}...(cut)`
  const user = [
    `Today is ${todayUtc().toISOString().slice(0, 10)}.`,
    `A content calendar, tab by tab (header row, then rows): ${body}`,
    "",
    'Summarise it. Return {"headline": one sentence on what this month holds, "counts": [{"label": e.g. "Instagram posts" or "Approved", "value": e.g. "12"}] (4 to 8, by platform or tab, by status, by week), "upcoming": up to 5 items due in the next 7 days, "gaps": up to 5 gaps or risks (empty weeks, items with no date, nothing approved yet)}.',
  ].join("\n")
  const out = await aiComplete<{
    headline?: unknown
    counts?: unknown
    upcoming?: unknown
    gaps?: unknown
  }>({
    system: SYSTEM,
    user,
    model: AI_MODEL_SMART,
    json: true,
    maxTokens: 900,
    temperature: 0.2,
    timeoutMs: 60_000,
  })
  const list = (v: unknown, n: number) =>
    (Array.isArray(v) ? v : [])
      .map((x) => str(x, 200))
      .filter(Boolean)
      .slice(0, n)
  const summary: CalendarSummary = {
    headline: str(out.headline, 300),
    counts: (Array.isArray(out.counts) ? out.counts : [])
      .flatMap((c) => {
        const o = (c ?? {}) as Record<string, unknown>
        const label = str(o.label, 60)
        const value = str(String(o.value ?? ""), 30)
        return label && value ? [{ label, value }] : []
      })
      .slice(0, 8),
    upcoming: list(out.upcoming, 5),
    gaps: list(out.gaps, 5),
  }
  if (!summary.headline) throw new ValidationError("The AI did not return a summary - try again.")
  const saved = await db.projectWorkbookSummary.upsert({
    where: { workbookId },
    create: { workbookId, contentHash: hash, summary: summary as unknown as Prisma.InputJsonValue },
    update: {
      contentHash: hash,
      summary: summary as unknown as Prisma.InputJsonValue,
      generatedAt: new Date(),
    },
    select: { generatedAt: true },
  })
  return { summary, generatedAt: saved.generatedAt.toISOString(), cached: false }
}
