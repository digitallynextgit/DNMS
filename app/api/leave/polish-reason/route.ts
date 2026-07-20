import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { aiComplete, isAiConfigured, AiError } from "@/lib/ai"
import type { Session } from "next-auth"

export const runtime = "nodejs"

// POST /api/leave/polish-reason  { reason, leaveType?, days?, startDate?, endDate? }
// Returns THREE rewrites of the employee's own reason, in different registers, so
// they choose rather than accept whatever the model produced. Advisory only:
// nothing is stored, and the employee can always keep their original words.

const SYSTEM_PROMPT = `You help an employee word the reason on their leave request so their manager reads it clearly and takes it seriously. You are NOT writing the whole email - only the reason paragraph that sits inside it.

## Absolute rules (breaking these is a failure)
1. NEVER invent facts. Use only what the employee wrote. Do not add dates, illnesses, diagnoses, doctor visits, medical certificates, family details, destinations, names, or promises they did not make.
2. If the reason is vague, KEEP it vague. "Personal work" stays "personal work" - do not guess what the personal work is.
3. Do not exaggerate or add drama. Do not plead, apologise excessively, or grovel.
4. Never add a greeting ("Dear ..."), sign-off ("Regards"), subject line, quotes, bullet points, or markdown. The surrounding email already has those.
5. Always reply in English, even when the input is Hindi, Hinglish, or broken English. Preserve the meaning, not the grammar mistakes.
6. Do not mention the leave dates or day-count. The email states those separately - repeating them is noise.
7. Keep the employee's own voice. First person, past/present tense as appropriate. Do not switch to third person.
8. Never reveal medical or personal detail BEYOND what the employee chose to share.

## Style
- 1-2 sentences. Short and plain. No corporate padding ("I am writing to inform you that...").
- Respectful and matter-of-fact, as if writing to your own manager.
- Indian workplace English is fine; avoid slang and avoid Americanisms.

## Output
Return a JSON object with exactly this shape:
{"variants":[{"label":"Concise","text":"..."},{"label":"Formal","text":"..."},{"label":"Detailed","text":"..."}]}

The three variants must be MEANINGFULLY different in register, not reworded near-duplicates:
- "Concise"  - the shortest honest version. One sentence.
- "Formal"   - polite and professional, suitable for a senior manager or a formal record.
- "Detailed" - slightly fuller context, but ONLY expanding on facts the employee actually gave. If they gave no extra facts, make this one read as a clear, complete sentence rather than inventing anything.`

const MAX_INPUT = 1000

interface Variant {
  label: string
  text: string
}

export const POST = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    if (!isAiConfigured()) {
      return NextResponse.json({ error: "AI is not configured on the server" }, { status: 503 })
    }

    let body: { reason?: string; leaveType?: string; days?: number }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const reason = body.reason?.trim()
    if (!reason) return NextResponse.json({ error: "Write a reason first" }, { status: 400 })
    if (reason.length > MAX_INPUT) {
      return NextResponse.json({ error: "Reason is too long to improve" }, { status: 422 })
    }

    const context = [
      body.leaveType ? `Leave type: ${body.leaveType}` : null,
      body.days ? `Duration: ${body.days} day(s) (context only - do NOT mention it)` : null,
      ``,
      `Employee's reason, verbatim:`,
      reason,
    ]
      .filter((l) => l !== null)
      .join("\n")

    try {
      const out = await aiComplete<{ variants?: Variant[] }>({
        system: SYSTEM_PROMPT,
        user: context,
        // A little room to differ between variants, but low enough to stay faithful.
        temperature: 0.6,
        maxTokens: 400,
        json: true,
      })

      // Trust nothing: strip wrapping quotes, drop empties, cap length, dedupe.
      const seen = new Set<string>()
      const variants = (out.variants ?? [])
        .map((v) => ({
          label: String(v?.label ?? "").trim() || "Suggestion",
          text: String(v?.text ?? "")
            .replace(/^["'\s]+|["'\s]+$/g, "")
            .slice(0, MAX_INPUT),
        }))
        .filter((v) => {
          const k = v.text.toLowerCase()
          if (!v.text || seen.has(k)) return false
          seen.add(k)
          return true
        })
        .slice(0, 3)

      if (variants.length === 0) throw new AiError("AI returned no usable suggestions", 502)
      return NextResponse.json({ data: { variants } })
    } catch (err) {
      console.error("[POLISH_REASON]", err)
      // AI is a convenience - it must never block applying for leave.
      return NextResponse.json(
        { error: err instanceof AiError ? err.message : "Couldn't improve the reason" },
        { status: 502 },
      )
    }
  },
)
