import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { aiComplete, isAiConfigured, AiError } from "@/lib/ai"
import type { Session } from "next-auth"

export const runtime = "nodejs"

const SYSTEM_PROMPT = `You are an expert recruitment copywriter for a creative digital agency.
Your job is to draft inspiring, on-brand job-posting copy.

Voice and style:
- Poetic, rhetorical, inviting - like a brand campaign, not a corporate listing.
- Open with a question or sensory image that makes the candidate feel seen.
- Avoid corporate clichés ("rockstar", "ninja", "synergy").
- Indian/global agency context. Casual but precise.

Example intro tone:
"Are you someone who lives and breathes trends, creativity, and content? Do you enjoy blending strategy with aesthetics - whether it's SEO, Graphics, Video editing or Social media? Join us as a Digital Marketing Intern and turn your ideas into impactful campaigns."

Output rules:
- Respond with a single JSON object only. No prose around it.
- Use these exact keys: meta, summary, intro, jobEssence, keyRequirements, currentOpenings.
- meta: short tag like "Mumbai · 3–5 yrs · Full-time" (≤ 60 chars). Optional, "" if unknown.
- summary: one-line pitch (≤ 140 chars).
- intro: 2–4 sentences in the example voice above. Mention the role title naturally.
- jobEssence: 2–3 sentences. Plainly state what the role accomplishes.
- keyRequirements: array of 5–8 strings. Concrete skills, tools, years of experience.
- currentOpenings: array of 1–3 strings. Seniority variants, e.g. "Junior X (1-2 Years Exp)", "Senior X (3-5 Years Exp)", "Lead". Empty array [] is OK for internships/single openings.
`

type Generated = {
  meta?: string
  summary?: string
  intro?: string
  jobEssence?: string
  keyRequirements?: string[]
  currentOpenings?: string[]
}

function sanitize(raw: unknown): Generated {
  if (!raw || typeof raw !== "object") return {}
  const obj = raw as Record<string, unknown>
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const arr = (v: unknown) =>
    Array.isArray(v)
      ? v.map((x) => (typeof x === "string" ? x.trim() : "")).filter((x) => x.length > 0)
      : []
  return {
    meta: str(obj.meta) || undefined,
    summary: str(obj.summary) || undefined,
    intro: str(obj.intro) || undefined,
    jobEssence: str(obj.jobEssence) || undefined,
    keyRequirements: arr(obj.keyRequirements),
    currentOpenings: arr(obj.currentOpenings),
  }
}

export const POST = withSession(async (req: NextRequest, _ctx: unknown, _session: Session) => {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "AI is not configured on the server" }, { status: 500 })
  }

  let body: { title?: string; departmentName?: string; type?: string; location?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const title = body.title?.trim()
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }

  const typeLabel =
    body.type === "INTERNSHIP"
      ? "Internship"
      : body.type === "PART_TIME"
        ? "Part-time"
        : body.type === "CONTRACT"
          ? "Contract"
          : body.type === "FREELANCE"
            ? "Freelance"
            : "Full-time"

  const userPrompt = [
    `Role title: ${title}`,
    body.departmentName ? `Department: ${body.departmentName}` : null,
    `Employment type: ${typeLabel}`,
    body.location ? `Location: ${body.location}` : null,
    "",
    "Generate the JSON object now.",
  ]
    .filter(Boolean)
    .join("\n")

  // One call through the shared client (lib/ai.ts) - it owns the provider, key,
  // timeout and error shape, so this route only cares about prompt + sanitising.
  try {
    const parsed = await aiComplete<unknown>({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      temperature: 0.75,
      maxTokens: 900,
      json: true,
    })
    return NextResponse.json({ data: sanitize(parsed) })
  } catch (err) {
    console.error("[GENERATE_JOB]", err)
    const status = err instanceof AiError ? (err.status ?? 502) : 502
    return NextResponse.json(
      { error: err instanceof AiError ? err.message : "Could not generate the job copy" },
      { status: status >= 500 ? status : 502 },
    )
  }
})
