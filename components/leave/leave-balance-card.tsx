"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LeaveBalance } from "@/hooks/use-leave"

interface LeaveBalanceCardProps {
  balance: LeaveBalance
}

export function LeaveBalanceCard({ balance }: LeaveBalanceCardProps) {
  const { leaveType, allocated, carried, used, pending } = balance
  const total = allocated + carried
  const available = Math.max(0, total - used - pending)
  const usedPercent = total > 0 ? Math.min(100, ((used + pending) / total) * 100) : 0
  const availablePercent = total > 0 ? (available / total) * 100 : 100

  // Theme-aware status accent (only used for the bar + small indicator dot)
  const accent =
    availablePercent > 50
      ? { bar: "bg-emerald-500", dot: "bg-emerald-500" }
      : availablePercent > 25
        ? { bar: "bg-amber-500", dot: "bg-amber-500" }
        : { bar: "bg-red-500", dot: "bg-red-500" }

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="space-y-3 p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", accent.dot)} />
              <h4 className="text-foreground truncate text-sm font-semibold">{leaveType.name}</h4>
            </div>
            <p className="text-muted-foreground mt-0.5 ml-3 text-[11px]">{leaveType.code}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium",
              leaveType.isPaid
                ? "border-border bg-muted/40 text-muted-foreground"
                : "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            {leaveType.isPaid ? "Paid" : "Unpaid"}
          </span>
        </div>

        {/* Hero number */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-foreground text-2xl font-bold tabular-nums">{available}</span>
          <span className="text-muted-foreground text-xs">
            / {total} {total === 1 ? "day" : "days"} left
          </span>
        </div>

        {/* Progress bar */}
        <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
          <div
            className={cn("h-full transition-all", accent.bar)}
            style={{ width: `${usedPercent}%` }}
          />
        </div>

        {/* Breakdown row */}
        <div className="flex items-center justify-between pt-1 text-[11px]">
          <BreakdownItem label="Used" value={used} />
          <BreakdownItem label="Pending" value={pending} amber={pending > 0} />
          <BreakdownItem label="Carried" value={carried} />
        </div>
      </CardContent>
    </Card>
  )
}

function BreakdownItem({ label, value, amber }: { label: string; value: number; amber?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          amber ? "text-amber-600 dark:text-amber-400" : "text-foreground",
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-[10px] tracking-wider uppercase">{label}</span>
    </div>
  )
}
