// Demo performance: KPI profiles for most people and two evaluation batches (last fortnight's, closed, and
// the open one). Shapes mirror features/performance/evaluation.ts.

import { randomUUID } from "node:crypto"
import { DEMO_PEOPLE } from "@/features/help/demo/dataset"
import { addDays, at, idOf, makeMany, ymd, type DemoContext } from "./context"

const MODULE = "Performance"

const SECTION_A_LABEL = "Role Performance (KRA & KPI)"
const SECTION_B_LABEL = "Workplace Discipline & Execution Effectiveness"

const SECTION_B = [
  "Task Closure & Accountability",
  "Proactive Work Communication",
  "Adaptability & Improvement Orientation",
  "Situational Handling & Solution Orientation",
  "Workplace timings and Professional conduct",
]

/** Role KPIs (section A), by department. */
const KPIS_BY_DEPARTMENT: Record<string, string[]> = {
  Design: [
    "On-time delivery of creatives",
    "Brand guideline adherence",
    "First-time-right rate (revisions per creative)",
    "Concept strength and visual quality",
    "Tool proficiency (Figma, Adobe CC)",
  ],
  Content: [
    "Content delivered vs monthly plan",
    "Grammar, tone and editorial quality",
    "SEO-friendliness of copy",
    "Turnaround on client revisions",
    "Research depth and originality",
  ],
  SEO: [
    "Keyword movement into the top 10",
    "Organic traffic growth vs target",
    "Technical audit issues closed",
    "Quality backlinks acquired",
    "Monthly SEO report on time",
  ],
  "Social Media": [
    "Content calendar adherence",
    "Engagement rate vs target",
    "Community response time",
    "Follower growth across handles",
    "Monthly social report quality",
  ],
  Creative: [
    "Team deliveries on schedule",
    "Client satisfaction across accounts",
    "Creative quality and consistency",
    "Mentoring and reviews for the team",
    "Resource planning and allocation",
  ],
  Technology: [
    "Sprint commitments delivered",
    "Bug recurrence and rework",
    "Site performance (Core Web Vitals)",
    "Code review and documentation",
    "IT support turnaround",
  ],
  "Human Resources": [
    "Time to hire for open roles",
    "Onboarding checklist completion",
    "Attendance and leave records accuracy",
    "Employee query resolution time",
    "Engagement initiatives delivered",
  ],
  Finance: [
    "Invoices raised on time",
    "Collections follow-up",
    "Vendor payment accuracy",
    "Monthly books closed on time",
    "GST and TDS compliance",
  ],
  Sales: [
    "Qualified leads generated",
    "Proposals sent vs target",
    "Lead-to-client conversion rate",
    "CRM pipeline hygiene",
  ],
}

// Video editing sits in Creative but is scored on its own craft.
const VIDEO_KPIS = [
  "Edits delivered on schedule",
  "Revision rounds per video",
  "Storytelling and pacing",
  "Motion graphics and sound quality",
]

/** Everyone but the director and the six-day-old joinee has a profile. */
const NO_PROFILE = new Set(["aarav", "rahul"])

/** Rough ability per person (1-5 centre), so scores tell a consistent story. */
const STRENGTH: Record<string, number> = {
  neha: 4.4,
  rohan: 4.3,
  priya: 4.1,
  karthik: 4.5,
  ananya: 3.8,
  vikram: 4.0,
  sneha: 3.6,
  arjun: 3.9,
  meera: 4.2,
  ishaan: 3.4,
  kavya: 3.9,
  pooja: 3.5,
}

/** The open batch, by person. Priya's self-evaluation is deliberately PENDING. */
const OPEN_STATUS: Record<string, "PENDING" | "SELF_DONE" | "MANAGER_DONE" | "COMPLETED"> = {
  priya: "PENDING",
  ananya: "SELF_DONE",
  vikram: "COMPLETED",
  sneha: "MANAGER_DONE",
  arjun: "SELF_DONE",
  pooja: "PENDING",
  karthik: "COMPLETED",
  meera: "SELF_DONE",
  ishaan: "PENDING",
  kavya: "COMPLETED",
  neha: "MANAGER_DONE",
  rohan: "SELF_DONE",
}

interface Criterion {
  id: string
  section: "A" | "B"
  label: string
  description: string | null
  weight: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

function score(criteria: Criterion[], ratings: Record<string, number>): number {
  return round1(criteria.reduce((sum, c) => sum + (c.weight * (ratings[c.id] ?? 0)) / 5, 0))
}

/** The cron's period label: "Oct 1 to 15 '26" / "Sep 16-EOM '26". */
function halfMonthLabel(start: Date): string {
  const month = start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
  const yy = String(start.getUTCFullYear()).slice(2)
  return `${month} ${start.getUTCDate() <= 15 ? "1 to 15" : "16-EOM"} '${yy}`
}

/** [start, end] of the half-month containing `d`. */
function halfMonth(d: Date): [Date, Date] {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  if (d.getUTCDate() <= 15) return [ymd(y, m, 1), ymd(y, m, 15)]
  return [ymd(y, m, 16), new Date(Date.UTC(y, m, 0))]
}

export async function seedPerformance(ctx: DemoContext): Promise<void> {
  const r = ctx.rand

  const criteriaFor: Record<string, { self: Criterion[]; manager: Criterion[] }> = {}
  const kpiRows: Record<string, unknown>[] = []
  for (const p of DEMO_PEOPLE) {
    if (NO_PROFILE.has(p.key)) continue
    const roleKpis =
      p.key === "arjun"
        ? VIDEO_KPIS
        : (KPIS_BY_DEPARTMENT[p.department] ?? KPIS_BY_DEPARTMENT.Creative ?? [])
    const sides: Record<"SELF" | "MANAGER", Criterion[]> = { SELF: [], MANAGER: [] }
    for (const evaluator of ["SELF", "MANAGER"] as const) {
      const rows: { section: "A" | "B"; label: string; order: number }[] = [
        ...roleKpis.map((label, order) => ({ section: "A" as const, label, order })),
        ...SECTION_B.map((label, order) => ({ section: "B" as const, label, order })),
      ]
      const countA = roleKpis.length
      const countB = SECTION_B.length
      for (const row of rows) {
        const id = randomUUID()
        kpiRows.push({
          id,
          employeeId: idOf(ctx, p.key),
          evaluator,
          section: row.section,
          label: row.label,
          description: null,
          order: row.order,
          createdAt: at(addDays(ctx.today, -120), "12:00"),
        })
        sides[evaluator].push({
          id,
          section: row.section,
          label: row.label,
          description: null,
          weight: row.section === "A" ? 60 / countA : 40 / countB,
        })
      }
    }
    criteriaFor[p.key] = { self: sides.SELF, manager: sides.MANAGER }
  }
  const kpiCount = await makeMany(ctx, "perfKpi", kpiRows)
  ctx.summary.add(MODULE, "KPI profile rows (PerfKpi)", kpiCount)
  ctx.summary.add(MODULE, "people with a KPI profile", Object.keys(criteriaFor).length)

  // The open batch is the half-month that just ended; the closed one before it.
  const [curStart] = halfMonth(ctx.today)
  const [openStart, openEnd] = halfMonth(addDays(curStart, -1))
  const [closedStart, closedEnd] = halfMonth(addDays(openStart, -1))

  const rate = (key: string, bias = 0) => {
    const base = (STRENGTH[key] ?? 3.8) + bias + (r() - 0.5) * 1.4
    return Math.max(2, Math.min(5, Math.round(base)))
  }
  const ratingsFor = (key: string, criteria: Criterion[], bias = 0) =>
    Object.fromEntries(criteria.map((c) => [c.id, rate(key, bias)]))

  const SELF_COMMENTS = [
    "Delivered everything planned for the fortnight; two items slipped by a day because of late client inputs.",
    "Good fortnight overall. I want to cut revision rounds by sharing early drafts sooner.",
    "Handled a heavier load than usual this cycle and kept quality steady.",
    "Met my targets. Learning the new reporting template took longer than expected.",
  ]
  const MANAGER_COMMENTS = [
    "Reliable and well organised. Keep pushing on proactive updates to the account team.",
    "Solid output this period. Work on estimating effort more accurately.",
    "Strong quality and ownership. Ready for more client-facing responsibility.",
    "Consistent delivery. Needs to flag blockers earlier instead of at the deadline.",
  ]

  const evalRows: Record<string, unknown>[] = []
  let openCount = 0
  let closedCount = 0
  const statusCounts: Record<string, number> = {}
  for (const p of DEMO_PEOPLE) {
    const crit = criteriaFor[p.key]
    if (!crit || !p.manager) continue
    const employeeId = idOf(ctx, p.key)
    const managerId = idOf(ctx, p.manager)

    for (const batch of ["closed", "open"] as const) {
      const start = batch === "closed" ? closedStart : openStart
      const end = batch === "closed" ? closedEnd : openEnd
      const status = batch === "closed" ? "COMPLETED" : (OPEN_STATUS[p.key] ?? "PENDING")
      const selfDone = status === "SELF_DONE" || status === "COMPLETED"
      const mgrDone = status === "MANAGER_DONE" || status === "COMPLETED"
      const selfRatings = selfDone ? ratingsFor(p.key, crit.self, 0.3) : null
      const managerRatings = mgrDone ? ratingsFor(p.key, crit.manager) : null
      const created = at(addDays(end, 1), "06:00")
      evalRows.push({
        selfCriteria: crit.self,
        managerCriteria: crit.manager,
        sectionALabel: SECTION_A_LABEL,
        sectionBLabel: SECTION_B_LABEL,
        employeeId,
        managerId,
        periodLabel: halfMonthLabel(start),
        periodStart: start,
        periodEnd: end,
        dueDate: addDays(end, 10),
        status,
        selfRatings: selfRatings ?? undefined,
        managerRatings: managerRatings ?? undefined,
        selfComment: selfDone ? r.pick(SELF_COMMENTS) : null,
        managerComment: mgrDone ? r.pick(MANAGER_COMMENTS) : null,
        selfSubmittedAt: selfDone ? at(addDays(end, r.int(2, 4)), "17:20") : null,
        managerSubmittedAt: mgrDone ? at(addDays(end, r.int(4, 6)), "18:05") : null,
        finalScore: managerRatings ? score(crit.manager, managerRatings) : null,
        createdById: idOf(ctx, "neha"),
        createdAt: created,
      })
      if (batch === "open") {
        openCount++
        statusCounts[status] = (statusCounts[status] ?? 0) + 1
      } else closedCount++
    }
  }
  await makeMany(ctx, "evaluation", evalRows)
  ctx.summary.add(MODULE, `evaluations "${halfMonthLabel(closedStart)}" (completed)`, closedCount)
  ctx.summary.add(MODULE, `evaluations "${halfMonthLabel(openStart)}" (open)`, openCount)
  for (const [s, n] of Object.entries(statusCounts)) {
    ctx.summary.add(MODULE, `  open batch ${s}`, n)
  }
}
