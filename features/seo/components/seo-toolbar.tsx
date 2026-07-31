"use client"

import { useState } from "react"
import { Download, Sparkles, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useSeoAi } from "../hooks/use-seo"

// =============================================================================
// Shared per-tab furniture: a one-line explanation of what the tab is for, an
// export button, and (where useful) an "Explain with AI" read-out.
//
// The explanation line exists because the module has a lot of tabs and none of
// them previously said what they were - an operator had to infer it from an
// empty table.
// =============================================================================

export function TabHeader({
  title,
  description,
  onExport,
  exportDisabled,
  children,
}: {
  title: string
  description: string
  onExport?: () => void
  exportDisabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 pb-1">
      <div className="min-w-60 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        {onExport && (
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={onExport}
            disabled={exportDisabled}
            title={exportDisabled ? "Nothing to export yet" : "Download as CSV"}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
        )}
      </div>
    </div>
  )
}

/** "What does this mean?" - a plain-language read of the site's current state. */
export function AiExplain({
  projectId,
  propertyId,
  className,
}: {
  projectId: string
  propertyId: string | null
  className?: string
}) {
  const ai = useSeoAi(projectId)
  const [text, setText] = useState<string | null>(null)

  if (!propertyId) return null

  const ask = () =>
    ai.mutate(
      { propertyId, task: "explain" },
      { onSuccess: (d) => setText(d.text ?? "No answer returned.") },
    )

  if (!text) {
    return (
      <Button
        size="sm"
        variant="outline"
        className={cn("h-8", className)}
        onClick={ask}
        disabled={ai.isPending}
      >
        <Sparkles className={cn("mr-1.5 h-3.5 w-3.5", ai.isPending && "animate-pulse")} />
        {ai.isPending ? "Reading the data…" : "Explain with AI"}
      </Button>
    )
  }

  return (
    <Card className="border-primary/30 bg-primary/5 w-full">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            What this means
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={ask}
              disabled={ai.isPending}
            >
              Re-ask
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setText(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">{text}</p>
        <p className="text-muted-foreground/70 mt-2 text-[11px]">
          AI-generated from this site&apos;s stored data - sanity-check before sending to a client.
        </p>
      </CardContent>
    </Card>
  )
}
