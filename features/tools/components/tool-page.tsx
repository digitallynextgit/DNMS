"use client"

import type { ReactNode } from "react"
import { ShieldCheck } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { getTool } from "../tools"

/** Title, one-liner and back link from tools.ts, so a tool component renders only its controls. */
export function ToolPage({
  slug,
  actions,
  children,
}: {
  slug: string
  actions?: ReactNode
  children: ReactNode
}) {
  const tool = getTool(slug)
  return (
    <div className="space-y-6">
      <PageHeader
        title={tool?.title ?? "Tool"}
        description={tool?.description}
        backHref="/tools"
        backLabel="Back to tools"
        actions={actions}
      />
      {children}
    </div>
  )
}

/** "Your files stay on your computer" - for tools that open files. */
export function PrivacyNote({ className }: { className?: string }) {
  return (
    <p
      className={
        "text-muted-foreground flex items-center gap-1.5 text-xs " + (className ? className : "")
      }
    >
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
      Your files stay on your computer - nothing is uploaded.
    </p>
  )
}
