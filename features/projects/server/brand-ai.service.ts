import "server-only"
import { tidyBrief } from "../lib/brief-text"

import { db } from "@/server/db"
import { AI_MODEL_SMART, aiComplete } from "@/lib/ai"
import { extractFileText, isExtractable } from "@/lib/file-text"
import { NotFoundError, ValidationError } from "@/lib/errors"

// =============================================================================
// "Draft the brand brief with AI".
//
// Reads the project's uploaded brief documents (PDF, Word, Excel/CSV, text),
// hands their text to the model in ONE call and gets back a structured brief,
// recommendations for the agency, and the questions the documents leave open.
//
// Nothing here writes to the database. The model proposes; a person reviews it
// in the dialog, applies it to the brief field, and saves through the normal
// brand route. Machine output never lands in a client-facing document unread.
// =============================================================================

export interface BrandSource {
  id: string
  fileName: string
  status: "read" | "skipped"
  /** Characters of text actually fed to the model. */
  chars: number
  reason?: string
}

export interface BrandAnalysis {
  /** Markdown, headed sections - see the prompt for the order. */
  brief: string
  recommendations: string[]
  /** Questions to put to the client for what the documents do not cover. */
  gaps: string[]
  sources: BrandSource[]
}

// Sized for mistral-medium's context with room for the answer. One deck of
// 40 slides is ~15k characters; five of them fit.
const PER_FILE_CHARS = 18_000
const TOTAL_CHARS = 60_000

const SYSTEM = `You are a senior brand strategist at a digital marketing agency. You write brand briefs a creative team can work from directly: specific, structured, and honest about what is known versus assumed. Use ONLY facts that appear in the documents you are given; mark anything you infer with "(inferred)". Never invent statistics, quotes, prices or client claims. Write in clear British English.`

const strings = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
    : []

export async function analyseBrandDocuments(
  projectId: string,
  assetIds?: string[],
): Promise<BrandAnalysis> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      description: true,
      client: { select: { name: true, industry: true, website: true } },
    },
  })
  if (!project) throw new NotFoundError("Project")

  const assets = await db.brandAsset.findMany({
    where: {
      projectId,
      kind: "BRIEF",
      ...(assetIds && assetIds.length > 0 ? { id: { in: assetIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, fileName: true, fileSize: true, mimeType: true, objectKey: true },
  })
  if (assets.length === 0) throw new ValidationError("Upload at least one brief document first")

  const sources: BrandSource[] = []
  const docs: string[] = []
  let budget = TOTAL_CHARS

  for (const a of assets) {
    if (budget <= 0) {
      sources.push({ ...pick(a), status: "skipped", chars: 0, reason: "Document limit reached" })
      continue
    }
    if (!isExtractable(a.mimeType, a.fileName)) {
      sources.push({
        ...pick(a),
        status: "skipped",
        chars: 0,
        reason: "Not a readable document (PDF, Word, Excel/CSV or text)",
      })
      continue
    }
    let failure: string | null = null
    const text = await extractFileText({
      ...a,
      maxChars: Math.min(PER_FILE_CHARS, budget),
      onError: (reason) => {
        failure = reason
      },
    })
    if (!text) {
      sources.push({
        ...pick(a),
        status: "skipped",
        chars: 0,
        // The real reason when there is one. The old copy guessed at a scan,
        // which sent everybody looking at the wrong thing.
        reason: failure ?? "Came back empty - no text in the file",
      })
      continue
    }
    budget -= text.length
    docs.push(`### ${a.fileName}\n${text}`)
    sources.push({ ...pick(a), status: "read", chars: text.length })
  }

  if (docs.length === 0) {
    // Say what happened to THIS file rather than asserting a cause: the
    // generic scanned-PDF line was wrong the first time it mattered.
    const why = sources.map((s) => `${s.fileName}: ${s.reason ?? "unknown reason"}`).join("; ")
    throw new ValidationError(`None of the documents could be read. ${why}`)
  }

  const client = project.client
  const user = [
    `Project: ${project.name}${project.description ? ` - ${project.description}` : ""}`,
    `Client: ${client?.name ?? "not recorded"}${client?.industry ? ` (${client.industry})` : ""}${client?.website ? `, ${client.website}` : ""}`,
    "",
    `DOCUMENTS (${docs.length}):`,
    "",
    docs.join("\n\n---\n\n"),
    "",
    "Write a brand brief from these documents, then recommendations.",
    "PLAIN TEXT ONLY - no markdown. No #, no **, no bullets made of *. Use a",
    "hyphen for dashes, never an em dash. Head each section with its number and",
    'name on its own line, e.g. "3. Target audience".',
    "Keep each section to what the documents actually support - a few sentences",
    "or short hyphen-led lines. A brief a team can read beats one nobody finishes.",
    "Return a JSON object with exactly these keys:",
    '- "brief": plain text with these sections in this order, each with concrete content from the documents (write "Not covered in the documents." under a heading when nothing applies):',
    "  1. Brand snapshot (who they are, what they sell, where they operate)",
    "  2. Products & services",
    "  3. Target audience (segments, needs, buying triggers)",
    "  4. Positioning & unique selling proposition",
    "  5. Brand personality & tone of voice",
    "  6. Visual identity (logo, colours, typography, imagery direction - only if described)",
    "  7. Competitors & market context",
    "  8. Business & marketing goals (with any numbers given)",
    "  9. Channels & content pillars",
    "  10. Mandatories & constraints (legal, budget, timelines, do-not-do)",
    "  11. Key messages",
    '- "recommendations": 6 to 10 specific, actionable recommendations for the agency\'s strategy for THIS brand, each one or two sentences starting with a verb.',
    '- "gaps": up to 8 questions to ask the client for information the documents do not cover.',
  ].join("\n")

  const out = await aiComplete<{ brief?: unknown; recommendations?: unknown; gaps?: unknown }>({
    system: SYSTEM,
    user,
    model: AI_MODEL_SMART,
    json: true,
    // Generation time tracks OUTPUT length almost linearly, and 3500 tokens of
    // brief was most of the wait. 2400 still covers eleven sections written
    // tightly; the prompt above asks for tight.
    maxTokens: 2400,
    temperature: 0.3,
    // Reading a few thousand words and writing a full brief takes the model a
    // while; the default 20s is sized for one-line rewrites.
    timeoutMs: 120_000,
  })

  const brief = typeof out.brief === "string" ? tidyBrief(out.brief) : ""
  if (!brief) throw new ValidationError("The AI did not return a brief - try again")

  return {
    brief,
    // The same treatment: these land in lists next to the brief.
    recommendations: strings(out.recommendations).map(tidyBrief).slice(0, 12),
    gaps: strings(out.gaps).map(tidyBrief).slice(0, 10),
    sources,
  }
}

function pick(a: { id: string; fileName: string }): { id: string; fileName: string } {
  return { id: a.id, fileName: a.fileName }
}
