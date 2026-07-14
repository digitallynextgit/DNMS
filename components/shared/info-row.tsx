import * as React from "react"

import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

// =============================================================================
// The ONE read-only label/value row, plus the section heading that sits above a
// grid of them. The employee profile, the my-profile page and the project
// overview each carried a byte-identical private copy of these.
// =============================================================================

export interface InfoRowProps {
  label: string
  value?: React.ReactNode
  /** Renders the value in the mono face (codes, ids). */
  mono?: boolean
  /** Small muted glyph before the value (e.g. a calendar for a date). */
  icon?: React.ElementType
  className?: string
}

export function InfoRow({ label, value, mono, icon: Icon, className }: InfoRowProps) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-muted-foreground text-xs tracking-wide uppercase">{label}</p>
      <p className={cn("flex items-center gap-1.5 text-sm font-medium", mono && "font-mono")}>
        {Icon && <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />}
        {value || "-"}
      </p>
    </div>
  )
}

interface SectionHeaderProps {
  children: React.ReactNode
  /** Trailing control (an edit button). Pass `false` to hide it on permission. */
  action?: React.ReactNode
  className?: string
}

export function SectionHeader({ children, action, className }: SectionHeaderProps) {
  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-foreground/80 text-sm font-semibold tracking-wider uppercase">
          {children}
        </h3>
        {action}
      </div>
      <Separator className="mb-4" />
    </div>
  )
}
