import * as React from "react"
import { Link } from "@/components/tenant-link"
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

// Phones wrap instead of truncating - with the actions stacked below there is a
// full row to use, and an ellipsised title/description reads as broken there.
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
      {/* Phones stack the actions under the title: the actions slot is shrink-0,
          so side-by-side it squeezes the (truncating) title down to nothing on a
          390px screen. From `sm` up the original single row is restored. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <div className="min-w-0 space-y-0.5">
            {/* `title` and `description` are ReactNode so a page can pass a <Skeleton>
                (or a row of icons) while its data loads. But <h1> and <p> only accept
                PHRASING content, and <Skeleton> is a <div> - `<div>` inside `<p>` is
                invalid HTML, which makes React discard the server markup and re-render
                (a hydration error). So the semantic <h1>/<p> is used for the normal
                string case, and a neutral wrapper for arbitrary nodes. */}
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
