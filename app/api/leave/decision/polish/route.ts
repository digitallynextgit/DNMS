import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { aiComplete, isAiConfigured, AiError } from "@/lib/ai"
import type { Session } from "next-auth"

export const runtime = "nodejs"

// POST /api/leave/decision/polish  { message, approved }
// Rewrites the approver's approve/reject note into three registers so they pick
// rather than accept whatever the model produced. Advisory only - nothing stored.

const SYSTEM_PROMPT = `You help a manager / HR / admin word the short reply they are sending an employee to APPROVE or DECLINE a leave request. You are polishing THEIR letter body - the greeting through the sign-off.

## Absolute rules (breaking these is a failure)
1. NEVER invent facts. Use only what the approver wrote plus the approved/declined outcome. Do not add policy, dates, day-counts, conditions, or reasons they did not state.
2. Keep the decision UNCHANGED. An approval stays an approval; a decline stays a decline. Never soften a decline into a maybe or vice-versa.
3. Keep it respectful and professional - a real person writing to a colleague, not a system notice. No corporate padding ("I am writing to inform you that...").
4. Keep the greeting ("Dear <name>,") and a sign-off ("Best Regards,") - this IS the full letter body. Do NOT add a subject line, a signature block, quotes, bullet points, or markdown.
5. Always reply in English, even if the input is Hindi/Hinglish. Preserve meaning, not grammar mistakes.
6. Keep it short - 2 to 4 short sentences between greeting and sign-off.
7. If a decline reason is present, keep it, worded plainly and without blame.

## Output
Return a JSON object with exactly this shape:
{"variants":[{"label":"Warm","text":"..."},{"label":"Neutral","text":"..."},{"label":"Formal","text":"..."}]}

The three variants must differ in register (warm / plain-neutral / formal), not be reworded near-duplicates. Each "text" is the WHOLE letter body including "Dear ..." and "Best Regards,".`

const MAX_INPUT = 4000

interface Variant {
  label: string
  text: string
}

export const POST = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    if (!isAiConfigured()) {
      return NextResponse.json({ error: "AI is not configured on the server" }, { status: 503 })
    }

    let body: { message?: string; approved?: boolean }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const message = body.message?.trim()
    if (!message) return NextResponse.json({ error: "Nothing to improve yet" }, { status: 400 })
    if (message.length > MAX_INPUT) {
      return NextResponse.json({ error: "Message is too long to improve" }, { status: 422 })
    }

    const context = [
      `Decision: ${body.approved ? "APPROVED" : "DECLINED"}`,
      ``,
      `Approver's letter, verbatim:`,
      message,
    ].join("\n")

    try {
      const out = await aiComplete<{ variants?: Variant[] }>({
        system: SYSTEM_PROMPT,
        user: context,
        temperature: 0.6,
        maxTokens: 700,
        json: true,
      })

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
      console.error("[POLISH_DECISION]", err)
      return NextResponse.json(
        { error: err instanceof AiError ? err.message : "Couldn't improve the message" },
        { status: 502 },
      )
    }
  },
)
