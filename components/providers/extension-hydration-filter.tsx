"use client"

// Dev only: drops hydration warnings caused by browser-extension attributes (e.g. Bitdefender's
// bis_skin_checked on every div). suppressHydrationWarning doesn't inherit, and stripping the
// attributes just fights the extension. Only messages naming a known extension attribute are hidden.

const EXTENSION_SCHEMES = ["chrome-extension://", "moz-extension://", "safari-web-extension://"]

const EXTENSION_ATTRIBUTES = [
  // Bitdefender
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

  const head = typeof args[0] === "string" ? args[0] : ""
  if (!head.includes("hydrat") && !head.includes("Hydrat")) return false

  const blob = args.map(toText).join(" ")
  return EXTENSION_ATTRIBUTES.some((attr) => blob.includes(attr))
}

/** True only if some frame is from an extension AND none is from this origin. */
function isExtensionOnlyStack(reason: unknown): boolean {
  const stack = reason instanceof Error ? `${reason.message} ${reason.stack ?? ""}` : toText(reason)
  if (!stack) return false
  if (!EXTENSION_SCHEMES.some((scheme) => stack.includes(scheme))) return false
  return !stack.includes(window.location.origin)
}

// Installed at module scope so it's in place before React hydrates. The guard is a tag on the
// installed function (not a window flag), so it reinstalls if Fast Refresh replaces console.error.
const INSTALLED = Symbol.for("dnms.extensionHydrationFilter")

type TaggedConsoleError = typeof console.error & { [INSTALLED]?: true }

if (
  process.env.NODE_ENV !== "production" &&
  typeof window !== "undefined" &&
  !(console.error as TaggedConsoleError)[INSTALLED]
) {
  // Next's overlay and terminal forwarder stay downstream, so suppressed messages reach neither.
  const downstream = console.error.bind(console)
  const filtered: TaggedConsoleError = (...args: unknown[]) => {
    if (isExtensionHydrationNoise(args)) return
    downstream(...args)
  }
  filtered[INSTALLED] = true
  console.error = filtered

  // Extension promise rejections too. Capture phase + stopImmediatePropagation, because Next's
  // overlay also listens on window and preventDefault alone wouldn't stop it.
  window.addEventListener(
    "unhandledrejection",
    (event) => {
      if (!isExtensionOnlyStack(event.reason)) return
      event.preventDefault()
      event.stopImmediatePropagation()
    },
    true,
  )
}

/** Renders nothing; imported for its side effect in a way the bundler can't tree-shake. */
export function ExtensionHydrationFilter() {
  return null
}
