// =============================================================================
// Merge-variable engine
// =============================================================================
// Client-safe (no server imports): the compose screen previews with the exact
// same function the runner sends with, so what you see is what goes out.
//
// The rule that matters: an UNKNOWN variable renders as EMPTY, never as literal
// "{{plan}}". Templates are written once and the recipient list changes under
// them, so requiring every placeholder to exist on every row would mean either
// maintaining both in lockstep or mailing subscribers raw markup.
//
// Supports a fallback: {{name|there}} → the name, or "there" when it is missing
// or blank. That is what makes "Hi {{name|there}}," safe on a list where only
// some rows have a name.
// =============================================================================

/** Always available, whatever custom fields a recipient carries. */
export const BUILTIN_VARS = [
  { key: "name", description: "Recipient's full name" },
  { key: "first_name", description: "First word of their name" },
  { key: "email", description: "Their email address" },
  { key: "company", description: "Their company" },
] as const

/** `{{ key | fallback }}` - whitespace tolerant, fallback optional. */
const TOKEN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*(?:\|([^}]*))?\}\}/g

/** Every distinct variable a template references, in first-seen order. */
export function extractVars(...texts: string[]): string[] {
  const found = new Set<string>()
  for (const text of texts) {
    if (!text) continue
    for (const m of text.matchAll(TOKEN)) {
      if (m[1]) found.add(m[1])
    }
  }
  return [...found]
}

export interface MergeSource {
  email: string
  name?: string | null
  company?: string | null
  /** Arbitrary extras from ProjectRecipient.fields. */
  fields?: Record<string, unknown> | null
}

/** Flatten a recipient into the variable map the renderer reads. */
export function buildVars(source: MergeSource): Record<string, string> {
  const name = (source.name ?? "").trim()
  const vars: Record<string, string> = {
    name,
    first_name: name.split(/\s+/)[0] ?? "",
    email: source.email,
    company: (source.company ?? "").trim(),
  }

  // Custom fields last so a list can override a builtin if it really wants to.
  if (source.fields && typeof source.fields === "object") {
    for (const [k, v] of Object.entries(source.fields)) {
      if (v === null || v === undefined) continue
      vars[k] = String(v)
    }
  }
  return vars
}

/**
 * Substitute every `{{var}}`. Unknown or blank → the fallback, else empty.
 *
 * Runs on the raw string rather than the DOM, so it works identically for the
 * subject line, hand-written HTML and rich-text output.
 */
export function renderMerge(text: string, vars: Record<string, string>): string {
  if (!text) return ""
  return text.replace(TOKEN, (_full, key: string, fallback?: string) => {
    const value = vars[key]
    if (value !== undefined && value !== "") return value
    return (fallback ?? "").trim()
  })
}

/** Plausible stand-ins, so a preview looks like a real email and not a form. */
export const SAMPLE_VARS: Record<string, string> = {
  name: "Priya Sharma",
  first_name: "Priya",
  email: "priya@example.com",
  company: "Example Pvt Ltd",
}

/**
 * Preview values: real sample data for builtins, and a visible placeholder for
 * anything custom, so an unfilled variable is obvious in the preview instead of
 * silently collapsing to nothing the way it will when sent.
 */
export function previewVars(usedVars: string[], overrides: Record<string, string> = {}) {
  const vars: Record<string, string> = { ...SAMPLE_VARS }
  for (const key of usedVars) {
    if (!(key in vars)) vars[key] = `[${key}]`
  }
  return { ...vars, ...overrides }
}
