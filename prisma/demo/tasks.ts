// =============================================================================
// Tasks: everyone's daily task sheet from the first of last month to the end
// of this week, so My Tasks, the dashboards, Progress and the month-end Work
// Report all have something to show.
//
// How the app reads them (features/projects, features/work-reports):
//   - the day a task sits on is its dueDate; Plan = title, Actual = description
//   - Hrs allocated = estimatedHours, Hrs spent = loggedHours
//   - the Work Report takes its hours ONLY from IN_PROGRESS TaskStatusPeriod
//     rows, so every task carries a status history whose IN_PROGRESS stretch
//     equals loggedHours, with exactly one open period (its current status)
//   - DONE has completedAt; ON_HOLD has holdReason + holdExpectedDate and a
//     follow-up TODO task (resumedFromId); DISCARDED has discardReason
//   - adhoc work has no project and no team, and produces no output
//
// Only Priya's one running task has a live clock (inProgressSince): a running
// clock is what the 60-second reminder job watches, so keeping it to one task
// keeps "time almost up" notifications to a minimum.
// =============================================================================

import { randomUUID } from "node:crypto"
import { DEMO_PEOPLE } from "@/features/help/demo/dataset"
import {
  addDays,
  at,
  awayOn,
  dayKey,
  firstOfMonth,
  idOf,
  makeMany,
  mondayOf,
  shiftWorkingDays,
  workingDays,
  type DemoContext,
} from "./context"

const M = "Tasks"

type Status = "TODO" | "IN_PROGRESS" | "DONE" | "ON_HOLD" | "DISCARDED"

interface TaskSpec {
  who: string
  project: string | null // null = adhoc
  team: string | null
  title: string
  actual: string | null
  est: number
  logged: number
  status: Status
  day: Date
  goal?: string
  requirement?: string
  links?: string[]
  running?: boolean
  holdReason?: string
  discardReason?: string
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  byManager?: boolean
  detail?: boolean // checklist + comments
}

/** Projects (and the team) each person works on, mirroring projects.ts TEAMS. */
const WORKS_ON: Record<string, [string, string][]> = {
  priya: [
    ["sunrise", "DESIGN"],
    ["urbannest", "DESIGN"],
    ["fitlife", "DESIGN"],
    ["internal", "DESIGN"],
  ],
  rahul: [["fitlife", "DESIGN"]],
  ananya: [
    ["sunrise", "MAP"],
    ["urbannest", "MAP"],
    ["internal", "MAP"],
  ],
  vikram: [
    ["sunrise", "MAP"],
    ["urbannest", "MAP"],
  ],
  sneha: [
    ["sunrise", "AMG/SMO"],
    ["fitlife", "AMG/SMO"],
  ],
  arjun: [
    ["sunrise", "VIDEO"],
    ["fitlife", "VIDEO"],
  ],
  karthik: [
    ["urbannest", "WEB"],
    ["internal", "WEB"],
  ],
  rohan: [
    ["sunrise", "DESIGN"],
    ["urbannest", "DESIGN"],
    ["fitlife", "DESIGN"],
  ],
  pooja: [],
}

const BRAND: Record<string, string> = {
  sunrise: "Sunmeadow",
  urbannest: "UrbanNest",
  fitlife: "FitLife",
  internal: "Website",
}

/** [plan title, estimate h, actual note] by person. "{b}" = the project's short name. */
const WORK: Record<string, [string, number, string][]> = {
  priya: [
    ["{b} - Instagram statics (4)", 3, "Delivered 4 statics; one revision on the price callout."],
    ["{b} - story set for the weekend", 2, "6 stories exported in 9:16 and shared in the folder."],
    ["{b} - banner resizes for ads", 1.5, "Resized to 1080x1080, 1200x628 and 1080x1920."],
    ["{b} - presentation deck design", 3, "Designed 14 slides for the client review."],
    [
      "{b} - packaging mock-up revisions",
      2.5,
      "Updated colours and the nutrition table as per client notes.",
    ],
  ],
  rahul: [
    ["{b} - icon style references", 2, "Collected 20 references, shortlisted 6 directions."],
    ["{b} - resize social templates", 1.5, "Templates resized for stories and posts."],
    ["Figma basics and team libraries", 2, "Went through the team library and naming conventions."],
  ],
  ananya: [
    ["{b} - blog draft", 3, "1,200-word draft shared for review."],
    ["{b} - captions for next week's posts", 2, "12 captions with hashtags added to the calendar."],
    ["{b} - landing page copy", 2.5, "Hero, benefits and FAQ sections written."],
    ["{b} - reel scripts (3)", 2, "Three 30-second scripts with hooks."],
    ["{b} - proofread product pages", 1.5, "Fixed 23 issues across 6 pages."],
  ],
  vikram: [
    [
      "{b} - technical audit: crawl errors",
      3,
      "Fixed 18 broken links; 6 redirect chains left for dev.",
    ],
    ["{b} - keyword mapping for service pages", 2.5, "Mapped 40 keywords to 12 pages."],
    ["{b} - backlink outreach (10 sites)", 2, "Sent 10 pitches, 2 replies so far."],
    ["{b} - on-page fixes", 2, "Titles and meta descriptions updated on 9 pages."],
    ["{b} - weekly ranking check", 1, "4 keywords moved into the top 10."],
  ],
  sneha: [
    ["{b} - schedule this week's posts", 1.5, "8 posts scheduled in Meta Business Suite."],
    ["{b} - community replies and DMs", 1, "Replied to 46 comments and 12 DMs."],
    ["{b} - weekly performance snapshot", 1.5, "Reach up 12% week on week; shared in the chat."],
    ["{b} - influencer shortlist", 2, "Shortlisted 15 micro-creators with rates."],
  ],
  arjun: [
    ["{b} - edit product reel", 3, "First cut done, music licensed."],
    ["{b} - colour grade shoot footage", 2.5, "Graded 14 clips to the brand LUT."],
    ["{b} - subtitles and end card", 1.5, "Hindi and English subtitles burned in."],
    ["{b} - motion graphics for teaser", 3, "Logo reveal and price tags animated."],
  ],
  karthik: [
    ["{b} - fix mobile menu overlap", 1.5, "Fixed on iOS Safari and Android Chrome."],
    ["{b} - speed: lazy-load images", 2.5, "Mobile LCP down from 3.8s to 2.1s."],
    [
      "{b} - enquiry form to CRM integration",
      3,
      "Form posts to the CRM; tested 5 enquiries end to end.",
    ],
    ["{b} - staging deploy and QA", 2, "Deployed to staging, QA checklist 22/24 passed."],
  ],
  rohan: [
    ["{b} - client review call", 1, "Feedback captured in the project chat."],
    ["{b} - creative review", 1.5, "Approved 9 of 11 creatives, notes on the rest."],
    ["{b} - plan next week's deliverables", 1, "Weekly plan updated on the Deliverables tab."],
  ],
  pooja: [
    [
      "Handover notes - Sunmeadow content",
      2,
      "Tone guide, open drafts and client preferences documented.",
    ],
    ["Handover notes - UrbanNest blog", 2, "Content calendar and keyword briefs handed to Ananya."],
    ["Copy QA for the content team", 1.5, "Reviewed 6 pieces before they go to clients."],
  ],
}

const HOLD_REASONS = [
  "Waiting for the client's feedback on the previous round.",
  "Client asked us to pause until the new pricing is final.",
]
const DISCARD_REASONS = ["Client dropped this from the plan.", "Merged into another task."]

function generic(ctx: DemoContext, until: Date, priyaFrom: Date): TaskSpec[] {
  const r = ctx.rand
  const from = firstOfMonth(ctx.today, -1)
  const mon = mondayOf(ctx.today)
  const out: TaskSpec[] = []
  for (const p of DEMO_PEOPLE) {
    const work = WORK[p.key]
    if (!work) continue
    const projects = WORKS_ON[p.key] ?? []
    let n = 0
    for (const day of workingDays(ctx, from, until)) {
      if (p.key === "rahul" && day < addDays(ctx.today, -p.joinedDaysAgo)) continue
      if (p.key === "priya" && day >= priyaFrom) continue
      const away = awayOn(ctx, p.key, day)
      if (away && away !== "WFH") continue
      const perDay = p.key === "rohan" ? 1 : 2
      for (let i = 0; i < perDay; i++) {
        n++
        const [title, est, actual] = work[(n + i) % work.length]!
        let pr = projects.length ? projects[n % projects.length]! : null
        // This week Sunmeadow gets a deliberate 10-15 tasks (GUIDE REQUIREMENT,
        // projects): Priya's hand-placed ones plus everyone else's first task
        // on Monday and Thursday; the rest of their week is other accounts.
        const sunrisePr = projects.find(([k]) => k === "sunrise")
        if (day >= mon && sunrisePr) {
          const others = projects.filter(([k]) => k !== "sunrise")
          const sunriseSlot = i === 0 && (day.getUTCDay() === 1 || day.getUTCDay() === 4)
          pr = sunriseSlot || others.length === 0 ? sunrisePr : others[n % others.length]!
        }
        const isPast = day < ctx.today
        const isToday = day.getTime() === ctx.today.getTime()
        let status: Status = "TODO"
        const roll = r()
        if (isPast)
          status =
            roll < 0.04
              ? "ON_HOLD"
              : roll < 0.06
                ? "DISCARDED"
                : roll < 0.08 && day >= mon
                  ? "TODO"
                  : "DONE"
        else if (isToday && i === 0) status = "IN_PROGRESS"
        const logged =
          status === "DONE"
            ? Math.max(0.5, Math.round((est + (r() - 0.5)) * 4) / 4)
            : status === "ON_HOLD" || status === "IN_PROGRESS"
              ? Math.round(est * 0.4 * 4) / 4
              : 0
        out.push({
          who: p.key,
          project: pr ? pr[0] : null,
          team: pr ? pr[1] : null,
          title: title.replace("{b}", pr ? BRAND[pr[0]]! : "Internal"),
          actual:
            status === "DONE"
              ? actual
              : status === "IN_PROGRESS"
                ? "Halfway through - finishing after lunch."
                : null,
          est,
          logged,
          status,
          day,
          goal: pr?.[0] === "sunrise" && p.key === "arjun" ? "goal:reels" : undefined,
          links:
            status === "DONE" && r.chance(0.4)
              ? [
                  `https://example.com/${(pr ? BRAND[pr[0]]! : "internal").toLowerCase()}/${dayKey(day)}-${n}`,
                ]
              : [],
          holdReason: status === "ON_HOLD" ? r.pick(HOLD_REASONS) : undefined,
          discardReason: status === "DISCARDED" ? r.pick(DISCARD_REASONS) : undefined,
          byManager: r.chance(0.3),
          detail: pr?.[0] === "sunrise" && day >= mon,
        })
      }
      // A short weekly team sync on Mondays - adhoc work, no project.
      if (day.getUTCDay() === 1 && p.key !== "pooja") {
        const isPast = day < ctx.today
        out.push({
          who: p.key,
          project: null,
          team: null,
          title: p.key === "rohan" ? "1:1s with the creative team" : "Weekly team sync",
          actual: isPast ? "Priorities for the week agreed." : null,
          est: p.key === "rohan" ? 2 : 0.5,
          logged: isPast ? (p.key === "rohan" ? 2 : 0.5) : 0,
          status: isPast ? "DONE" : "TODO",
          day,
        })
      }
    }
  }
  return out
}

/**
 * Priya's week, placed by hand. Working-day offsets from today, so "due
 * today", "overdue" and "in progress" are always true whenever the seed runs.
 *
 * GUIDE REQUIREMENT (projects / getting started): 8-12 tasks across 3+
 * projects plus adhoc work; some due today, one overdue, one blocked by an open
 * requirement, some in progress / completed with time spent.
 */
function priyaWeek(ctx: DemoContext): TaskSpec[] {
  const d = (n: number) => (n === 0 ? ctx.today : shiftWorkingDays(ctx, ctx.today, n))
  const base = { who: "priya" }
  return [
    {
      ...base,
      project: "sunrise",
      team: "DESIGN",
      day: d(-2),
      title: "Diwali offer website banner (desktop + mobile)",
      est: 3,
      logged: 3.5,
      status: "DONE",
      actual: "Banner v2 approved by the client. Exported desktop 1920x800 and mobile 1080x1350.",
      goal: "goal:launch-web",
      links: ["https://example.com/sunmeadow/offer-banner-v2"],
      priority: "HIGH",
      byManager: true,
      detail: true,
    },
    {
      ...base,
      project: "urbannest",
      team: "DESIGN",
      day: d(-2),
      title: "Property listing page icons (12)",
      est: 2,
      logged: 2,
      status: "DONE",
      actual: "12 icons delivered as SVG, matched to the new site style.",
      links: ["https://example.com/urbannest/icons"],
    },
    {
      ...base,
      project: "sunrise",
      team: "DESIGN",
      day: d(-1),
      title: "Instagram carousel - millet benefits (5 slides)",
      est: 3,
      logged: 2.75,
      status: "DONE",
      actual: "5 slides done; Ananya's copy fitted after two trims.",
      goal: "goal:launch-social",
      detail: true,
    },
    {
      ...base,
      project: "fitlife",
      team: "DESIGN",
      day: d(-1),
      title: "FitLife moodboard v1",
      est: 2.5,
      logged: 1.25,
      status: "ON_HOLD",
      actual: "Two directions started - paused for the client's brand questionnaire.",
      holdReason: "Waiting for the brand questionnaire from FitLife.",
    },
    {
      ...base,
      project: "internal",
      team: "DESIGN",
      day: d(-1),
      title: "Team page photo treatments",
      est: 1.5,
      logged: 0,
      status: "TODO",
      actual: null,
    },
    {
      ...base,
      project: "sunrise",
      team: "DESIGN",
      day: d(0),
      title: "Diwali hamper statics (6)",
      est: 4,
      logged: 0,
      status: "IN_PROGRESS",
      actual: "3 of 6 done - hamper and price callouts as per banner v2.",
      goal: "goal:launch-social",
      links: ["https://example.com/figma/sunmeadow-diwali"],
      running: true,
      priority: "HIGH",
      byManager: true,
      detail: true,
    },
    {
      ...base,
      project: "sunrise",
      team: "DESIGN",
      day: d(0),
      title: "Product label mock-ups (atta, poha, cookies)",
      est: 2.5,
      logged: 0,
      status: "TODO",
      actual: null,
      requirement: "req:photos",
      detail: true,
    },
    {
      ...base,
      project: null,
      team: null,
      day: d(0),
      title: "Design team weekly sync",
      est: 0.5,
      logged: 0,
      status: "TODO",
      actual: null,
    },
    {
      ...base,
      project: "urbannest",
      team: "DESIGN",
      day: d(1),
      title: "Hero banner refresh for festive offers",
      est: 3,
      logged: 0,
      status: "TODO",
      actual: null,
    },
    {
      ...base,
      project: null,
      team: null,
      day: d(1),
      title: "Interview panel - Graphic Designer candidate",
      est: 1,
      logged: 0,
      status: "TODO",
      actual: null,
    },
    {
      ...base,
      project: "sunrise",
      team: "DESIGN",
      day: d(2),
      title: "Reel cover templates (3)",
      est: 2,
      logged: 0,
      status: "TODO",
      actual: null,
      detail: true,
    },
    {
      ...base,
      project: "fitlife",
      team: "DESIGN",
      day: d(2),
      title: "Logo exploration - round 2",
      est: 3,
      logged: 0,
      status: "TODO",
      actual: null,
    },
  ]
}

const CHECKLISTS: Record<string, string[]> = {
  default: ["Brief and references checked", "First draft shared", "Feedback incorporated"],
  design: [
    "Brand colours and fonts checked",
    "Desktop + mobile sizes exported",
    "Uploaded to the project folder",
  ],
}
const COMMENTS: [string, string][] = [
  ["rohan", "Client wants this before the Thursday review - can we make it?"],
  ["priya", "Yes, first version by tomorrow noon."],
]

export async function seedTasks(ctx: DemoContext): Promise<void> {
  const friday = addDays(mondayOf(ctx.today), 4)
  const priyaFrom = shiftWorkingDays(ctx, ctx.today, -2)
  const specs = [...generic(ctx, friday, priyaFrom), ...priyaWeek(ctx)]

  const tasks: Record<string, unknown>[] = []
  const periods: Record<string, unknown>[] = []
  const checklist: Record<string, unknown>[] = []
  const comments: Record<string, unknown>[] = []
  const activity: Record<string, unknown>[] = []
  const counts: Record<string, number> = {}
  const managerOf = (project: string | null, who: string) =>
    project
      ? who === "rohan"
        ? "aarav"
        : "rohan"
      : (DEMO_PEOPLE.find((p) => p.key === who)?.manager ?? "aarav")

  const hours = (h: number) => h * 3_600_000
  const add = (spec: TaskSpec, extra: { id?: string; resumedFromId?: string } = {}) => {
    const id = extra.id ?? randomUUID()
    const assignee = idOf(ctx, spec.who)
    const creator = spec.byManager ? idOf(ctx, managerOf(spec.project, spec.who)) : assignee
    const created = at(addDays(spec.day, -1), "18:20")
    const start = at(spec.day, spec.est >= 3 ? "10:05" : "14:30")
    const running = spec.running && ctx.now.getTime() > start.getTime()
    const inProgressSince = running
      ? new Date(Math.max(start.getTime(), ctx.now.getTime() - 25 * 60_000))
      : null
    const end = new Date(start.getTime() + hours(spec.logged))
    tasks.push({
      id,
      projectId: spec.project ? ctx.project[spec.project] : null,
      teamId: spec.project && spec.team ? ctx.team[spec.project]![spec.team] : null,
      title: spec.title,
      description: spec.actual,
      status: spec.status,
      priority: spec.priority ?? "MEDIUM",
      assigneeId: assignee,
      creatorId: creator,
      startDate: spec.day,
      dueDate: spec.day,
      completedAt: spec.status === "DONE" ? end : null,
      estimatedHours: spec.est,
      loggedHours: spec.logged,
      inProgressSince,
      tags:
        spec.project === "sunrise" && spec.title.toLowerCase().includes("diwali")
          ? ["festive"]
          : [],
      links: spec.links ?? [],
      approvalStatus: "APPROVED",
      isManagerCreated: creator !== assignee,
      holdReason: spec.holdReason ?? null,
      holdExpectedDate:
        spec.status === "ON_HOLD"
          ? shiftWorkingDays(ctx, spec.day < ctx.today ? ctx.today : spec.day, 3)
          : null,
      discardReason: spec.discardReason ?? null,
      goalId: spec.goal ? (ctx.ref[spec.goal] ?? null) : null,
      requirementId: spec.requirement ? (ctx.ref[spec.requirement] ?? null) : null,
      resumedFromId: extra.resumedFromId ?? null,
      producesOutput: spec.project !== null,
      createdAt: created,
      updatedAt: spec.status === "TODO" ? created : end,
    })
    counts[spec.status] = (counts[spec.status] ?? 0) + 1

    // Status history: TODO -> (IN_PROGRESS) -> current, exactly one open row.
    const actor = assignee
    const seconds = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 1000)
    if (spec.status === "TODO") {
      periods.push({ taskId: id, status: "TODO", actorId: null, startedAt: created, endedAt: null })
    } else if (spec.status === "DISCARDED") {
      const at_ = at(spec.day, "11:00")
      periods.push({
        taskId: id,
        status: "TODO",
        actorId: null,
        startedAt: created,
        endedAt: at_,
        durationSeconds: seconds(created, at_),
      })
      periods.push({
        taskId: id,
        status: "DISCARDED",
        actorId: actor,
        startedAt: at_,
        endedAt: null,
        note: spec.discardReason,
      })
    } else {
      periods.push({
        taskId: id,
        status: "TODO",
        actorId: null,
        startedAt: created,
        endedAt: start,
        durationSeconds: seconds(created, start),
      })
      if (spec.status === "IN_PROGRESS") {
        // Earlier stretches today are already in loggedHours; the open one is now.
        const openFrom = inProgressSince ?? start
        if (spec.logged > 0 && !running) {
          periods.push({
            taskId: id,
            status: "IN_PROGRESS",
            actorId: actor,
            startedAt: start,
            endedAt: null,
          })
        } else {
          periods.push({
            taskId: id,
            status: "IN_PROGRESS",
            actorId: actor,
            startedAt: openFrom,
            endedAt: null,
          })
        }
      } else {
        periods.push({
          taskId: id,
          status: "IN_PROGRESS",
          actorId: actor,
          startedAt: start,
          endedAt: end,
          durationSeconds: seconds(start, end),
        })
        periods.push({
          taskId: id,
          status: spec.status,
          actorId: actor,
          startedAt: end,
          endedAt: null,
          note: spec.status === "ON_HOLD" ? spec.holdReason : null,
        })
      }
    }

    if (spec.detail) {
      const items = spec.team === "DESIGN" ? CHECKLISTS.design! : CHECKLISTS.default!
      items.forEach((text, i) =>
        checklist.push({
          taskId: id,
          text,
          isChecked: spec.status === "DONE" || (spec.status === "IN_PROGRESS" && i === 0),
          displayOrder: i,
          createdAt: created,
        }),
      )
      COMMENTS.forEach(([by, text], i) =>
        comments.push({
          taskId: id,
          authorId: idOf(ctx, by === "priya" ? spec.who : by),
          content: text,
          createdAt: new Date(created.getTime() + (i + 1) * 15 * 60_000),
        }),
      )
    }
    if (spec.project && spec.day >= addDays(mondayOf(ctx.today), -7)) {
      const projectId = ctx.project[spec.project]
      activity.push({
        projectId,
        actorId: creator,
        type: "TASK_CREATED",
        entityType: "ProjectTask",
        entityId: id,
        meta: { taskTitle: spec.title, teamId: tasks.at(-1)!.teamId, assigneeId: assignee },
        createdAt: created,
      })
      if (spec.status !== "TODO") {
        activity.push({
          projectId,
          actorId: actor,
          type: "TASK_STATUS_CHANGED",
          entityType: "ProjectTask",
          entityId: id,
          meta: {
            taskTitle: spec.title,
            from: "TODO",
            to: spec.status === "DISCARDED" ? "DISCARDED" : "IN_PROGRESS",
          },
          createdAt: start,
        })
      }
      if (spec.status === "DONE" || spec.status === "ON_HOLD") {
        activity.push({
          projectId,
          actorId: actor,
          type: "TASK_STATUS_CHANGED",
          entityType: "ProjectTask",
          entityId: id,
          meta: { taskTitle: spec.title, from: "IN_PROGRESS", to: spec.status },
          createdAt: end,
        })
      }
      if (spec.detail) {
        activity.push({
          projectId,
          actorId: idOf(ctx, "rohan"),
          type: "COMMENT_ADDED",
          entityType: "ProjectTask",
          entityId: id,
          meta: { taskTitle: spec.title },
          createdAt: new Date(created.getTime() + 15 * 60_000),
        })
      }
    }
    return id
  }

  for (const spec of specs) {
    const id = add(spec)
    // Putting work on hold books the rest of it onto a follow-up task.
    if (spec.status === "ON_HOLD") {
      const resume = shiftWorkingDays(ctx, spec.day < ctx.today ? ctx.today : spec.day, 3)
      add(
        {
          ...spec,
          day: resume,
          status: "TODO",
          logged: 0,
          est: Math.max(0.5, spec.est - spec.logged),
          actual: null,
          holdReason: undefined,
          running: false,
          detail: false,
          links: [],
        },
        { resumedFromId: id },
      )
    }
  }

  // Inserted in creation order so the follow-ups (resumedFromId) find their parent.
  await makeMany(ctx, "projectTask", tasks)
  await makeMany(ctx, "taskStatusPeriod", periods)
  await makeMany(ctx, "taskChecklistItem", checklist)
  await makeMany(ctx, "taskComment", comments)
  await makeMany(ctx, "projectActivity", activity)
  ctx.summary.add(
    M,
    `tasks ${dayKey(firstOfMonth(ctx.today, -1))} .. ${dayKey(friday)}`,
    tasks.length,
  )
  for (const [s, n] of Object.entries(counts)) ctx.summary.add(M, `  ${s}`, n)
  ctx.summary.add(M, "status-history rows (Work Report hours)", periods.length)
  ctx.summary.add(M, "checklist items / comments", checklist.length + comments.length)
  ctx.summary.add(M, "project activity rows (tasks)", activity.length)
}
