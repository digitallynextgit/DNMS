import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const SIZES = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
} as const

interface SpinnerProps {
  size?: keyof typeof SIZES
  className?: string
}

/**
 * The one spinner. Replaces the ~50 hand-copied
 * `<Loader2 className="mr-2 h-4 w-4 animate-spin" />` lines (which shipped in 5
 * different sizes). Inside a <Button>, prefer `<Button loading>` over this.
 */
export function Spinner({ size = "md", className }: SpinnerProps) {
  return <Loader2 className={cn("animate-spin", SIZES[size], className)} aria-hidden="true" />
}

/** Centered spinner for a whole page/panel that is still loading. */
export function PageSpinner({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn("flex min-h-[40vh] flex-col items-center justify-center gap-3", className)}
      role="status"
    >
      <Spinner size="xl" className="text-muted-foreground" />
      {label && <p className="text-muted-foreground text-sm">{label}</p>}
      <span className="sr-only">{label ?? "Loading"}</span>
    </div>
  )
}
