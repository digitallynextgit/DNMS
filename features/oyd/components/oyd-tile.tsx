"use client"

import { Flag } from "lucide-react"

import { Link } from "@/components/tenant-link"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useOydFlags } from "../hooks/use-oyd"
import { countsTowardsLevel, levelFor } from "../lib/oyd-rules"

/** Dashboard tile beside My Rating: your active OYD flags and the step they put you on. */
export function OydTile({ className }: { className?: string }) {
  const { data, isLoading } = useOydFlags()
  const active =
    data?.flags.filter((f) => f.employee.id === data.viewer.id && countsTowardsLevel(f)).length ?? 0
  const step = levelFor(active)

  return (
    <Link
      href="/oyd"
      className={cn("focus-visible:ring-ring block rounded-sm focus-visible:ring-2", className)}
      title={step ? `${step.label}: ${step.action}` : "Own Your Deadline"}
    >
      <Card className="border-border bg-card hover:border-foreground/25 h-full rounded-sm border transition-colors">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                OYD Flags
              </p>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p
                  className={cn(
                    "text-2xl font-semibold tracking-tight tabular-nums",
                    active === 0 && "text-emerald-600 dark:text-emerald-400",
                    active >= 3 && "text-red-600 dark:text-red-400",
                  )}
                >
                  {active}
                </p>
              )}
              <p className="text-muted-foreground truncate text-xs">
                {step ? `${step.emoji} ${step.label}` : "No active flags"}
              </p>
            </div>
            <Flag className="text-muted-foreground h-4 w-4 shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
