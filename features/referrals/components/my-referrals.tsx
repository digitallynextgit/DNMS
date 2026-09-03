"use client"

import { useState } from "react"
import { Award, CheckCircle2, Clock, IndianRupee, UserPlus, Users, XCircle } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { useMyReferrals } from "../hooks/use-referrals"
import { ReferDialog } from "./refer-dialog"
import type { ReferralRow, ReferralStage, RewardState } from "../types"

/** Stage colours reuse the app's status tones - a state, never a series. */
const STAGE: Record<ReferralStage, { label: string; className: string }> = {
  RECEIVED: { label: "Received", className: "bg-muted text-muted-foreground" },
  IN_REVIEW: { label: "In review", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  SHORTLISTED: {
    label: "Shortlisted",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  HIRED: {
    label: "Hired",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  REJECTED: { label: "Not selected", className: "bg-muted text-muted-foreground" },
}

const REWARD: Record<RewardState, { label: string; className: string }> = {
  none: { label: "", className: "" },
  pending: { label: "Reward pending", className: "text-muted-foreground" },
  due: { label: "Reward due", className: "text-emerald-600 dark:text-emerald-400 font-medium" },
  paid: { label: "Reward paid", className: "text-muted-foreground" },
}

export function MyReferrals() {
  const { data, isLoading } = useMyReferrals()
  const [referOpen, setReferOpen] = useState(false)

  const s = data?.summary

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Referrals"
        description="People you have put forward, how far they got, and what you have earned."
        actions={
          <Button onClick={() => setReferOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Refer someone
          </Button>
        }
      />

      {/* What to pass on. Nobody knows their own employee number offhand, and a
          candidate who guesses gets nothing credited to anybody. */}
      {data?.me.employeeNo && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 text-sm">
            <span className="text-muted-foreground">
              Applying on the careers site? Ask them to put this in
              <span className="text-foreground font-medium"> &ldquo;Referred by&rdquo;</span>:
            </span>
            <code className="bg-muted rounded-sm px-2 py-0.5 font-mono text-sm font-semibold">
              {data.me.employeeNo}
            </code>
            <span className="text-muted-foreground text-xs">
              your work email works too - either one credits the referral to you
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} label="Referred" value={s?.total ?? 0} loading={isLoading} />
        <Stat icon={CheckCircle2} label="Hired" value={s?.hired ?? 0} loading={isLoading} />
        <Stat icon={Clock} label="In progress" value={s?.inProgress ?? 0} loading={isLoading} />
        <Stat
          icon={IndianRupee}
          label="Earned"
          value={s ? formatCurrency(s.earned) : "-"}
          sub={s && s.rewardDue > 0 ? `${s.rewardDue} due` : undefined}
          loading={isLoading}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-sm" />
          ))}
        </div>
      ) : !data || data.rows.length === 0 ? (
        <EmptyState
          icon={Award}
          title="You have not referred anyone yet."
          description="Know someone good? Refer them and you earn a reward once they complete a year."
          action={{ label: "Refer someone", onClick: () => setReferOpen(true) }}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {data.rows.map((r) => (
            <ReferralCard key={r.id} row={r} />
          ))}
        </div>
      )}

      <ReferDialog open={referOpen} onOpenChange={setReferOpen} />
    </div>
  )
}

function ReferralCard({ row }: { row: ReferralRow }) {
  const stage = STAGE[row.stage]
  const reward = REWARD[row.reward.state]

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{row.fullName}</p>
            <Badge variant="outline" className={cn("border-0 py-0 text-[10px]", stage.className)}>
              {stage.label}
            </Badge>
            {row.isInternalReferral && (
              <span className="text-muted-foreground text-[10px]">referred by you in DNMS</span>
            )}
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {row.roleTitle} · {row.departmentTitle} · referred {formatDate(row.submittedAt)}
          </p>
        </div>

        {/* The reward story, in words. "Pending" without a date is the kind of
            thing people ask HR about; the date answers it up front. */}
        {row.reward.state !== "none" && (
          <div className="text-right">
            <p className={cn("text-xs", reward.className)}>{reward.label}</p>
            <p className="text-muted-foreground text-[11px]">
              {row.reward.state === "pending" && row.reward.eligibleOn && (
                <>
                  due {formatDate(row.reward.eligibleOn)}
                  {row.reward.daysToGo != null && ` · ${row.reward.daysToGo} days to go`}
                </>
              )}
              {row.reward.state === "due" && "one year served"}
              {row.reward.state === "paid" && row.reward.paidAt && (
                <>paid {formatDate(row.reward.paidAt)}</>
              )}
            </p>
          </div>
        )}

        {row.reward.amount != null && (
          <div className="text-right">
            <p className="font-semibold tabular-nums">{formatCurrency(row.reward.amount)}</p>
            <p className="text-muted-foreground text-[11px]">
              {row.reward.state === "paid" ? "paid" : "estimated"}
            </p>
          </div>
        )}

        {row.stage === "REJECTED" && (
          <XCircle className="text-muted-foreground/50 h-4 w-4 shrink-0" />
        )}
      </CardContent>
    </Card>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: typeof Users
  label: string
  value: string | number
  sub?: string
  loading?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-sm">
          <Icon className="text-muted-foreground h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-14" />
          ) : (
            <p className="text-lg font-bold">
              {value}
              {sub && <span className="text-muted-foreground ml-1 text-xs font-normal">{sub}</span>}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
