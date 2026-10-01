import "server-only"

import { aiComplete, isAiConfigured } from "@/lib/ai"
import type { WorkReport } from "../types"

// =============================================================================
// Optional polish: task titles are written in a hurry ("resposniveness fix @5h"),
// and a report goes to a manager and HR. AI rewrites the per-person highlights
// and the impact bullets into plain sentences - from the titles and numbers in
// the report only, never adding work. Any failure leaves the plain version in
// place: the download must not depend on an AI provider being up.
// =============================================================================

const SYSTEM = `You polish a month-end work report that goes to a manager and HR.
Rewrite rough task titles into short, plain-English bullets about what was done.
Rules:
- Use ONLY work named in the input. Never invent tasks, outcomes, numbers or names.
- Fix spelling and capitalisation. No marketing language, no exclamation marks.
- Each bullet: max 24 words, starts with the project name exactly as given, then a colon.
- Keep any numbers that appear in the input exactly as they are.
Reply with JSON only.`

const CONCURRENCY = 3

interface PersonPolish {
  highlights?: unknown
}
interface ImpactPolish {
  projects?: { project?: unknown; bullets?: unknown }[]
}

const strings = (v: unknown, max: number): string[] | null =>
  Array.isArray(v) && v.every((s) => typeof s === "string" && s.trim())
    ? (v as string[]).map((s) => s.trim()).slice(0, max)
    : null

async function polishPerson(report: WorkReport, index: number): Promise<boolean> {
  const p = report.people[index]!
  if (!p.projectHours.length) return false
  const work = p.projectHours.slice(0, 6).map(({ project, hours }) => ({
    project,
    hours,
    tasks: Array.from(
      new Set(
        p.days.flatMap((d) =>
          d.lines.filter((l) => l.project === project).flatMap((l) => l.text.split("; ")),
        ),
      ),
    ).slice(0, 25),
  }))
  const out = await aiComplete<PersonPolish>({
    system: SYSTEM,
    user: JSON.stringify({
      instruction: `Write up to 4 highlight bullets for ${p.name} (${p.designation ?? "employee"}) for ${report.period.label}, one per project, biggest project first.`,
      reply_shape: { highlights: ["string"] },
      work,
    }),
    model: "fast",
    json: true,
    maxTokens: 500,
    timeoutMs: 20_000,
  })
  const highlights = strings(out?.highlights, 4)
  if (!highlights) return false
  p.highlights = highlights
  return true
}

async function polishImpact(report: WorkReport): Promise<boolean> {
  if (!report.impact.length) return false
  const out = await aiComplete<ImpactPolish>({
    system: SYSTEM,
    user: JSON.stringify({
      instruction:
        "For each project, write 2-3 bullets on what the team delivered this month. Keep the first bullet's task count and hours exactly as given.",
      reply_shape: { projects: [{ project: "string", bullets: ["string"] }] },
      projects: report.impact.map((c) => ({
        project: c.project,
        facts: c.bullets,
        tasks: Array.from(
          new Set(
            report.people.flatMap((p) =>
              p.days.flatMap((d) =>
                d.lines.filter((l) => l.project === c.project).flatMap((l) => l.text.split("; ")),
              ),
            ),
          ),
        ).slice(0, 30),
      })),
    }),
    model: "fast",
    json: true,
    maxTokens: 1200,
    timeoutMs: 25_000,
  })
  let changed = false
  for (const item of out?.projects ?? []) {
    const card = report.impact.find((c) => c.project === item.project)
    const bullets = strings(item.bullets, 3)
    if (card && bullets) {
      card.bullets = bullets
      changed = true
    }
  }
  return changed
}

/** Rewrites highlights and impact bullets in place. Returns whether anything was polished. */
export async function polishWorkReport(report: WorkReport): Promise<boolean> {
  if (!isAiConfigured()) return false
  const jobs: (() => Promise<boolean>)[] = [
    () => polishImpact(report),
    ...report.people.map((_, i) => () => polishPerson(report, i)),
  ]
  let polished = 0
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(jobs.slice(i, i + CONCURRENCY).map((job) => job()))
    for (const r of results) {
      if (r.status === "fulfilled") polished += Number(r.value)
      else console.warn("[work-report] AI polish skipped:", r.reason)
    }
  }
  report.aiPolished = polished > 0
  return report.aiPolished
}
