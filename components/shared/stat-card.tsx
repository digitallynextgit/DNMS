import * as React from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ElementType
  iconColor?: string
  iconBg?: string
  trend?: { value: number; label: string }
  /** Draws the value as a skeleton in the card's real shape (no layout shift). */
  loading?: boolean
  className?: string
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  loading = false,
  className,
}: StatCardProps) {
  const isPositive = trend ? trend.value >= 0 : true

  return (
    <Card className={cn("border-border bg-card rounded border", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-foreground text-2xl font-semibold tracking-tight">{value}</p>
            )}
            {description && <p className="text-muted-foreground text-xs">{description}</p>}
            {trend && (
              <div className="flex items-center gap-1">
                {isPositive ? (
                  <TrendingUp className="text-muted-foreground h-3 w-3" />
                ) : (
                  <TrendingDown className="text-muted-foreground h-3 w-3" />
                )}
                {/* No unit is assumed - `label` carries it ("vs last month", "%"...). */}
                <span className="text-foreground text-xs font-medium">
                  {isPositive ? "+" : ""}
                  {trend.value}
                </span>
                <span className="text-muted-foreground text-xs">{trend.label}</span>
              </div>
            )}
          </div>
          {/* When a caller supplies iconBg, the icon gets a tinted tile; otherwise
              it stays a plain muted glyph. */}
          {iconBg ? (
            <div className={cn("flex h-9 w-9 items-center justify-center rounded", iconBg)}>
              <Icon className={cn("h-4 w-4", iconColor ?? "text-muted-foreground")} />
            </div>
          ) : (
            <Icon className={cn("h-4 w-4", iconColor ?? "text-muted-foreground")} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
