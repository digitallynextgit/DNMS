import * as React from "react"
import Link from "next/link"
import { Inbox } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon?: React.ElementType
  title: string
  description?: string
  /** Optional CTA. Provide `href` for navigation or `onClick` for an action. */
  action?: { label: string; onClick?: () => void; href?: string }
  /** "card" wraps the empty state in the standard `bg-card` bordered panel. */
  variant?: "plain" | "card"
  /** Tighter spacing for small in-card/sub-section empties. */
  compact?: boolean
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  variant = "plain",
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        compact ? "py-8" : "py-16",
        variant === "card" && "bg-card rounded border",
        className,
      )}
    >
      <div className="bg-accent flex items-center justify-center rounded-full p-3">
        <Icon className="text-muted-foreground h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-foreground text-sm font-medium">{title}</h3>
        {description && <p className="text-muted-foreground max-w-sm text-sm">{description}</p>}
      </div>
      {action &&
        (action.href ? (
          <Button asChild className="mt-1">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button onClick={action.onClick} className="mt-1">
            {action.label}
          </Button>
        ))}
    </div>
  )
}
