"use client"

// =============================================================================
// Live preview
// =============================================================================
// Renders inside a SANDBOXED IFRAME, for two reasons:
//
//   1. Honesty. The app's CSS reset and Tailwind base styles would restyle the
//      email, so a preview rendered inline in the page would look nothing like
//      what lands in an inbox. The iframe starts from the browser's own
//      defaults, which is much closer to what a mail client does.
//   2. Containment. Template bodies are hand-written HTML. `sandbox` with no
//      allow-scripts means nothing in a body can run script or reach the app.
// =============================================================================

import * as React from "react"
import { Eye } from "lucide-react"

import { cn } from "@/lib/utils"
import { renderMerge, extractVars, previewVars } from "../lib/merge"
import { makeImagesResponsive } from "../lib/email-html"

export function EmailPreview({
  subject,
  bodyHtml,
  fromName,
  fromEmail,
  /** Real values to preview with, e.g. the first recipient on the list. */
  overrides,
  className,
}: {
  subject: string
  bodyHtml: string
  fromName?: string
  fromEmail?: string
  overrides?: Record<string, string>
  className?: string
}) {
  const { renderedSubject, srcDoc, unresolved } = React.useMemo(() => {
    const used = extractVars(subject, bodyHtml)
    const vars = previewVars(used, overrides)

    // Anything the preview can only show as a placeholder is a variable the list
    // may not carry - worth flagging before 2,000 people get a blank.
    const unresolved = used.filter((k) => vars[k] === `[${k}]`)

    // The SAME normalisation the sender applies, rather than a stylesheet rule.
    // This used to carry `img { max-width:100% }` below, which quietly made every
    // preview look correct while the delivered mail overflowed: no mail client
    // applies our stylesheet, so the preview was showing a layout that only ever
    // existed here. Anything that shapes the email must happen to the HTML itself.
    const body = makeImagesResponsive(renderMerge(bodyHtml, vars))
    const doc = `<!doctype html><html><head><meta charset="utf-8">
<style>
  body { margin:0; padding:16px; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
         font-size:14px; line-height:1.6; color:#111827; background:#ffffff; }
  a { color:#2563eb; }
  h1,h2,h3 { margin:0 0 8px; }
  p { margin:0 0 12px; }
</style></head><body>${body}</body></html>`

    return { renderedSubject: renderMerge(subject, vars), srcDoc: doc, unresolved }
  }, [subject, bodyHtml, overrides])

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-sm border", className)}>
      <div className="bg-muted/40 space-y-1 border-b px-3 py-2">
        <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          <Eye className="h-3 w-3" />
          Preview
        </p>
        {(fromName || fromEmail) && (
          <p className="text-muted-foreground truncate text-[11px]">
            From: {fromName} {fromEmail && `<${fromEmail}>`}
          </p>
        )}
        <p className="truncate text-xs font-medium">{renderedSubject || "(no subject)"}</p>
      </div>

      {/* Emails render at ~600px; a full-width preview would flatter a layout
          that breaks in a real client. */}
      <iframe
        title="Email preview"
        srcDoc={srcDoc}
        sandbox=""
        className="min-h-64 w-full flex-1 bg-white"
      />

      {unresolved.length > 0 && (
        <p className="text-muted-foreground border-t px-3 py-2 text-[11px]">
          Shown as placeholders:{" "}
          <span className="font-mono">{unresolved.map((k) => `{{${k}}}`).join(" ")}</span> - these
          come from each recipient&apos;s fields and render empty when missing.
        </p>
      )}
    </div>
  )
}
