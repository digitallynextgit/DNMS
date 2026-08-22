"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { History, ShieldAlert } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import { formatDate } from "@/lib/utils"

interface TaskAccess {
  canEditPastTasks: boolean
  grantedAt: string | null
  grantedBy: { id: string; name: string } | null
}

/**
 * HR's switch for one person's task-edit window.
 *
 * Spelled out rather than labelled with a bare toggle: this hands somebody the
 * ability to change their own recorded hours after the fact, which is worth
 * being explicit about at the moment of granting it.
 */
export function EmployeeTaskAccess({
  employeeId,
  employeeName,
}: {
  employeeId: string
  employeeName: string
}) {
  const qc = useQueryClient()
  const key = ["employee-task-access", employeeId]

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await apiFetch<{ data: TaskAccess }>(`/api/employees/${employeeId}/task-access`)).data,
  })

  const update = useMutation(
    mutationWithToast(qc, {
      mutationFn: (enabled: boolean) =>
        apiFetch<{ data: TaskAccess }>(`/api/employees/${employeeId}/task-access`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        }),
      invalidate: [key],
      success: (_d, enabled) =>
        enabled ? "Past-task editing enabled" : "Past-task editing turned off",
    }),
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Editing past tasks
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          By default anyone can correct a task they raised for 15 minutes, and after that only their
          manager can. Turn this on to let {employeeName.split(" ")[0]} go back and fix earlier
          days.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 rounded-[2px] border p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Allow editing past tasks</p>
                <p className="text-muted-foreground text-xs">
                  Lets them change the title, dates, estimate and notes on tasks they raised,
                  however old.
                </p>
              </div>
              <Switch
                checked={!!data?.canEditPastTasks}
                disabled={update.isPending}
                onCheckedChange={(v) => update.mutate(v)}
                aria-label="Allow editing past tasks"
              />
            </div>

            {/* What it does NOT do. A permission is only safe to grant if the
                person granting it knows where it stops. */}
            <div className="text-muted-foreground space-y-1 text-xs">
              <p className="text-foreground flex items-center gap-1.5 font-medium">
                <ShieldAlert className="h-3.5 w-3.5" />
                What this does not allow
              </p>
              <p>· Editing tasks somebody else raised - still manager-only.</p>
              <p>· Deleting tasks - still manager-only, always.</p>
              <p>· Changing who a task is assigned to - that stays an allocation decision.</p>
            </div>

            {data?.grantedAt && (
              <p className="text-muted-foreground border-t pt-3 text-xs">
                {data.canEditPastTasks ? "Granted" : "Last changed"} {formatDate(data.grantedAt)}
                {data.grantedBy ? ` by ${data.grantedBy.name}` : ""}.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
