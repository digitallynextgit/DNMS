"use client"

import { useState } from "react"
import { AlertTriangle, IndianRupee, Link2 } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmployeeCombobox } from "@/features/employees"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { useAllReferrals, useReferralAction, type AdminReferralRow } from "../hooks/use-referrals"

export function ReferralsAdmin() {
  const { data, isLoading } = useAllReferrals()
  const action = useReferralAction()
  const [linking, setLinking] = useState<AdminReferralRow | null>(null)
  const [hireId, setHireId] = useState("")
  const [paying, setPaying] = useState<AdminReferralRow | null>(null)

  const rows = data ?? []
  const unresolved = rows.filter((r) => !r.referrer && r.claimedEmployeeNo)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Referrals"
        description="Every candidate somebody put forward, and the reward owed on them."
      />

      {/* An employee id that matched nobody is the one thing here that needs a
          human - surfaced rather than left to be noticed. */}
      {unresolved.length > 0 && (
        <Card className="border-l-2 border-l-amber-500">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="text-sm">
              <p className="font-medium">
                {unresolved.length} referral{unresolved.length === 1 ? "" : "s"} name an employee id
                that matches nobody
              </p>
              <p className="text-muted-foreground text-xs">
                {unresolved.map((r) => `"${r.claimedEmployeeNo}"`).join(", ")} - a typo, or an
                employee number that has changed. The application is stored either way.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-sm" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No referrals yet."
          description="They will appear here when an employee refers somebody, or a candidate names an employee id on the careers site."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{r.fullName}</p>
                    <Badge variant="outline" className="py-0 text-[10px]">
                      {r.stage.replace("_", " ").toLowerCase()}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {r.roleTitle} · referred by{" "}
                    {r.referrer ? (
                      <span className="text-foreground">
                        {r.referrer.name} ({r.referrer.employeeNo})
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">
                        unmatched id &quot;{r.claimedEmployeeNo}&quot;
                      </span>
                    )}
                  </p>
                </div>

                <div className="text-right text-xs">
                  {r.hire ? (
                    <>
                      <p>
                        Hired: <span className="font-medium">{r.hire.name}</span>
                      </p>
                      <p className="text-muted-foreground">
                        {r.reward.state === "paid"
                          ? `paid ${formatDate(r.reward.paidAt!)}`
                          : r.reward.state === "due"
                            ? "reward due now"
                            : r.reward.eligibleOn
                              ? `eligible ${formatDate(r.reward.eligibleOn)}`
                              : "no joining date"}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">not linked to an employee</p>
                  )}
                </div>

                {r.reward.amount != null && (
                  <p
                    className={cn(
                      "w-24 text-right font-semibold tabular-nums",
                      r.reward.state === "due" && "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {formatCurrency(r.reward.amount)}
                  </p>
                )}

                <div className="flex shrink-0 gap-2">
                  {/* Linking is offered for any hire that is not linked yet -
                      including one still marked shortlisted, because linking IS
                      the act of confirming the hire. */}
                  {!r.hire && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setHireId("")
                        setLinking(r)
                      }}
                    >
                      <Link2 className="mr-1.5 h-3.5 w-3.5" />
                      Link hire
                    </Button>
                  )}
                  {r.reward.state === "due" && (
                    <Button size="sm" onClick={() => setPaying(r)}>
                      <IndianRupee className="mr-1.5 h-3.5 w-3.5" />
                      Mark paid
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Link a hire to the employee record created for them. */}
      <Dialog open={!!linking} onOpenChange={(o) => !o && setLinking(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link the hire</DialogTitle>
            <DialogDescription>
              Pick the employee record created for {linking?.fullName}. Their date of joining starts
              the one-year clock on the referral reward.
            </DialogDescription>
          </DialogHeader>
          {/* Clearing the combobox hands back undefined; "" is this dialog's
              "nothing picked", which is what the submit button reads. */}
          <EmployeeCombobox value={hireId} onChange={(id) => setHireId(id ?? "")} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinking(null)}>
              Cancel
            </Button>
            <Button
              disabled={!hireId || action.isPending}
              onClick={() =>
                linking &&
                action.mutate(
                  { id: linking.id, action: "link-hire", hiredEmployeeId: hireId },
                  { onSuccess: () => setLinking(null) },
                )
              }
            >
              Link hire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!paying}
        onOpenChange={(o) => !o && setPaying(null)}
        title="Record this reward as paid?"
        description={
          paying
            ? `${formatCurrency(paying.reward.amount ?? 0)} to ${paying.referrer?.name ?? "the referrer"} for referring ${paying.fullName}. This records the payout and tells them - it does not move any money.`
            : ""
        }
        confirmLabel="Mark paid"
        isLoading={action.isPending}
        onConfirm={() =>
          paying &&
          action.mutate(
            { id: paying.id, action: "mark-paid" },
            { onSuccess: () => setPaying(null) },
          )
        }
      />
    </div>
  )
}
