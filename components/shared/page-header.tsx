import * as React from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  /** ReactNode (not just string) so a page can render a <Skeleton> title while its
   *  data loads, instead of blanking the whole screen. */
  title: React.ReactNode
  /**
   * Sub-line under the title. A node (not just a string) so detail pages can keep
   * the inline icons / emphasised counts they used to hand-roll (e.g. the employee
   * profile's "briefcase designation · building department" row).
   */
  description?: React.ReactNode
  actions?: React.ReactNode
  /**
   * Renders a "Back" button above the title. Detail pages used to hand-roll this
   * link OUTSIDE the header, in several different shapes - which is why the back
   * button sat at a different height/offset depending on which page you were on.
   */
  backHref?: string
  /**
   * In-page back (e.g. returning from a detail pane to a list) where there is no URL
   * to link to. Renders the SAME control as `backHref` - so an in-page back button
   * can't drift into a different shape. Ignored when `backHref` is set.
   */
  onBack?: () => void
  /** Label for the back button (default: "Back"). */
  backLabel?: string
  /**
   * Rendered immediately BEFORE the title (an avatar, a status chip, a code badge).
   * Detail pages used to hand-roll their whole header just to fit one of these next
   * to the title - which is why their titles were text-2xl while every other page
   * was text-lg.
   */
  leading?: React.ReactNode
  /** Rendered immediately AFTER the title, inline (e.g. a mono project-code chip). */
  titleSuffix?: React.ReactNode
  className?: string
}

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
        <Button variant="outline" size="sm" asChild className="group w-fit">
          <Link href={backHref}>
            <ChevronLeft className="transition-transform group-hover:-translate-x-0.5" />
            {backLabel}
          </Link>
        </Button>
      ) : onBack ? (
        <Button variant="outline" size="sm" onClick={onBack} className="group w-fit">
          <ChevronLeft className="transition-transform group-hover:-translate-x-0.5" />
          {backLabel}
        </Button>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="text-foreground truncate text-lg font-semibold tracking-tight">
                {title}
              </h1>
              {titleSuffix}
            </div>
            {description && <p className="text-muted-foreground truncate text-sm">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
