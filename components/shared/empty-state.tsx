import * as React from "react"
import { Link } from "@/components/tenant-link"
import { Inbox } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/** A CTA. Provide `href` for navigation or `onClick` for an action. */
interface EmptyAction {
  label: string
  onClick?: () => void
  href?: string
}

interface EmptyStateProps {
  icon?: React.ElementType
  title: string
  description?: string
  /** The primary CTA. */
  action?: EmptyAction
  /**
   * A second, outlined CTA beside the primary one - for an empty state with
   * two genuinely different ways in (e.g. build one, or import one).
   */
  secondaryAction?: EmptyAction
  /** "card" wraps the empty state in the standard `bg-card` bordered panel. */
  variant?: "plain" | "card"
  /** Tighter spacing for small in-card/sub-section empties. */
  compact?: boolean
  className?: string
}

function ActionButton({ action, variant }: { action: EmptyAction; variant?: "outline" }) {
  if (action.href) {
    return (
      <Button asChild variant={variant}>
        <Link href={action.href}>{action.label}</Link>
      </Button>
    )
  }
  return (
    <Button onClick={action.onClick} variant={variant}>
      {action.label}
    </Button>
  )
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  variant = "plain",
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        compact ? "py-8" : "py-16",
        variant === "card" && "bg-card rounded-sm border",
        className,
      )}
    >
      <div className="bg-accent flex items-center justify-center rounded-sm p-3">
        <Icon className="text-muted-foreground h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-foreground text-sm font-medium">{title}</h3>
        {description && <p className="text-muted-foreground max-w-sm text-sm">{description}</p>}
      </div>
      {(action || secondaryAction) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action && <ActionButton action={action} />}
          {secondaryAction && <ActionButton action={secondaryAction} variant="outline" />}
        </div>
      )}
    </div>
  )
}
