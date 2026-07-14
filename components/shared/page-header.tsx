import * as React from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  /**
   * Renders a "Back" button above the title. Detail pages used to hand-roll this
   * link OUTSIDE the header, in several different shapes - which is why the back
   * button sat at a different height/offset depending on which page you were on.
   */
  backHref?: string
  /** Label for the back button (default: "Back"). */
  backLabel?: string
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel = "Back",
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-2 py-4", className)}>
      {backHref && (
        <Button variant="outline" size="sm" asChild className="group w-fit">
          <Link href={backHref}>
            <ChevronLeft className="transition-transform group-hover:-translate-x-0.5" />
            {backLabel}
          </Link>
        </Button>
      )}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-foreground text-lg font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
