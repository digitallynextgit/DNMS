"use client"

// =============================================================================
// Silence hydration warnings caused by BROWSER EXTENSIONS (dev only)
// =============================================================================
// Bitdefender ("bis_skin_checked"), Grammarly, ColorZilla and friends mutate the
// DOM before React hydrates - Bitdefender stamps bis_skin_checked="1" onto EVERY
// <div> on the page. React then compares its server HTML (no attribute) against
// the live DOM (attribute present) and logs a hydration mismatch per element,
// which floods both the dev overlay and, via Next 16's
// logging.browserToTerminal, the terminal.
//
// suppressHydrationWarning cannot fix this: it applies to ONE element's own
// attributes and does not inherit, so it would have to be spelled on every div
// in the app. Stripping the attributes with a MutationObserver doesn't work
// either - the extension re-stamps whatever we remove, and the two sides just
// fight over the DOM forever.
//
// So we filter the message instead, as narrowly as possible:
//
//   1. DEV ONLY. Never patches console in production.
//   2. It must be a hydration message AND mention a known extension-injected
//      attribute name. A genuine mismatch in our own markup names OUR
//      attributes, so it is never matched and still reports in full.
//
// If you ever suspect this is hiding something, delete the <ExtensionHydration
// Filter /> line in providers.tsx - nothing else depends on it.
// =============================================================================

/** Attributes injected by extensions. Matching one of these is what makes a
 *  hydration warning "not our bug". */
const EXTENSION_ATTRIBUTES = [
  // Bitdefender / Bitdefender Internet Security
  "bis_skin_checked",
  "bis_register",
  "bis_size",
  "bis_id",
  "__processed_",
  // Grammarly
  "data-gr-",
  "data-gramm",
  "data-new-gr-c-s-check-loaded",
  // ColorZilla
  "cz-shortcut-listen",
  // LanguageTool
  "data-lt-installed",
]

/** Flatten console.error's arguments into searchable text. Only called once a
 *  message has already been identified as hydration-related, so the cost of
 *  stringifying is paid on a handful of calls, not on every log. */
function toText(value: unknown): string {
  if (typeof value === "string") return value
  if (value instanceof Error) return `${value.message} ${value.stack ?? ""}`
  try {
    return String(value)
  } catch {
    return ""
  }
}

function isExtensionHydrationNoise(args: unknown[]): boolean {
  if (args.length === 0) return false

  // Cheap gate first: React's hydration warnings all say "hydrat…" up front.
  const head = typeof args[0] === "string" ? args[0] : ""
  if (!head.includes("hydrat") && !head.includes("Hydrat")) return false

  const blob = args.map(toText).join(" ")
  return EXTENSION_ATTRIBUTES.some((attr) => blob.includes(attr))
}

// Installed at MODULE scope, not in an effect: this has to be in place before
// React hydrates, and effects run after.
//
// The guard is a tag on the function we install, not a window flag. If anything
// downstream (Next's overlay re-initialising on Fast Refresh) replaces
// console.error afterwards, the tag goes with it and we reinstall on the next
// evaluation - a window flag would leave the filter permanently bypassed.
const INSTALLED = Symbol.for("dnms.extensionHydrationFilter")

type TaggedConsoleError = typeof console.error & { [INSTALLED]?: true }

if (
  process.env.NODE_ENV !== "production" &&
  typeof window !== "undefined" &&
  !(console.error as TaggedConsoleError)[INSTALLED]
) {
  // Whatever already owns console.error (Next's dev overlay and its
  // browser-to-terminal forwarder) stays downstream of us, so a suppressed
  // message reaches neither surface.
  const downstream = console.error.bind(console)
  const filtered: TaggedConsoleError = (...args: unknown[]) => {
    if (isExtensionHydrationNoise(args)) return
    downstream(...args)
  }
  filtered[INSTALLED] = true
  console.error = filtered
}

/**
 * Renders nothing. It exists so the module is imported for its side effect in a
 * way the bundler cannot tree-shake away.
 */
export function ExtensionHydrationFilter() {
  return null
}
