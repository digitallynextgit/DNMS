import * as React from "react"
import { Link } from "@/components/tenant-link"
import { ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  /** A node, so a page can show a <Skeleton> title while loading. */
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  /** Renders a "Back" button above the title. */
  backHref?: string
  /** In-page back with no URL (e.g. detail pane to list). Same control as `backHref`; ignored when that's set. */
  onBack?: () => void
  /** Default "Back". */
  backLabel?: string
  /** Rendered just before the title (an avatar, a status chip, a code badge). */
  leading?: React.ReactNode
  /** Rendered immediately AFTER the title, inline (e.g. a mono project-code chip). */
  titleSuffix?: React.ReactNode
  className?: string
}

// Phones wrap instead of truncating - they have a full row.
const TITLE_CLASS = "text-foreground text-lg font-semibold tracking-tight sm:truncate"
const DESC_CLASS = "text-muted-foreground text-sm text-pretty sm:truncate"

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  onBack,
  backLabel = "Back",
  leading,
  titleSuffix,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-2 py-4", className)}>
      {backHref ? (
        <Button variant="outline" asChild className="group w-fit">
          <Link href={backHref}>
            <ChevronLeft className="transition-transform group-hover:-translate-x-0.5" />
            {backLabel}
          </Link>
        </Button>
      ) : onBack ? (
        <Button variant="outline" onClick={onBack} className="group w-fit">
          <ChevronLeft className="transition-transform group-hover:-translate-x-0.5" />
          {backLabel}
        </Button>
      ) : null}
      {/* Phones stack the actions under the title; side by side they'd squeeze it to nothing. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <div className="min-w-0 space-y-0.5">
            {/* <h1>/<p> only accept phrasing content, so a non-string title (e.g. a <Skeleton> div)
                gets a neutral wrapper - otherwise it's a hydration error. */}
            <div className="flex items-center gap-2">
              {typeof title === "string" ? (
                <h1 className={TITLE_CLASS}>{title}</h1>
              ) : (
                <div className={TITLE_CLASS}>{title}</div>
              )}
              {titleSuffix}
            </div>
            {description &&
              (typeof description === "string" ? (
                <p className={DESC_CLASS}>{description}</p>
              ) : (
                <div className={DESC_CLASS}>{description}</div>
              ))}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
