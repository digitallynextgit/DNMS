import * as React from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ElementType
  iconColor?: string
  iconBg?: string
  trend?: { value: number; label: string }
  className?: string
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: StatCardProps) {
  const isPositive = trend ? trend.value >= 0 : true

  return (
    <Card className={cn("border-border bg-card rounded-[var(--radius)] border", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              {title}
            </p>
            <p className="text-foreground text-2xl font-semibold tracking-tight">{value}</p>
            {description && <p className="text-muted-foreground text-xs">{description}</p>}
            {trend && (
              <div className="flex items-center gap-1">
                {isPositive ? (
                  <TrendingUp className="text-muted-foreground h-3 w-3" />
                ) : (
                  <TrendingDown className="text-muted-foreground h-3 w-3" />
                )}
                <span className="text-foreground text-xs font-medium">
                  {isPositive ? "+" : ""}
                  {trend.value}%
                </span>
                <span className="text-muted-foreground text-xs">{trend.label}</span>
              </div>
            )}
          </div>
          <Icon className="text-muted-foreground h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  )
}
