"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { CalendarDays } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { formatDate, cn } from "@/lib/utils"

interface Leave {
  id: string
  startDate: string
  endDate: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNo: string
    profilePhoto: string | null
  }
  leaveType: { name: string; code: string }
}

async function fetchCalendar(from: string, to: string): Promise<{ data: Leave[] }> {
  const res = await fetch(`/api/leave/calendar?from=${from}&to=${to}`)
  if (!res.ok) throw new Error("Failed to load leave calendar")
  return res.json()
}

function isOnLeaveToday(l: Leave): boolean {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return new Date(l.startDate) <= today && new Date(l.endDate) >= today
}

export default function LeaveCalendarPage() {
  const [month, setMonth] = useState(() => new Date())
  const from = format(startOfMonth(month), "yyyy-MM-dd")
  const to = format(endOfMonth(month), "yyyy-MM-dd")

  const { data, isLoading } = useQuery({
    queryKey: ["leave-calendar", from, to],
    queryFn: () => fetchCalendar(from, to),
  })
  const leaves = data?.data ?? []
  const outToday = leaves.filter(isOnLeaveToday)

  function Row({ l }: { l: Leave }) {
    return (
      <div className="flex items-center justify-between gap-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <AvatarDisplay
            src={l.employee.profilePhoto}
            firstName={l.employee.firstName}
            lastName={l.employee.lastName}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {l.employee.firstName} {l.employee.lastName}
            </p>
            <p className="text-muted-foreground text-xs">
              {formatDate(l.startDate, "dd MMM")} – {formatDate(l.endDate, "dd MMM")}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {l.leaveType.code}
        </Badge>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Leave Calendar" description="Who's on approved leave" />

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
        >
          &larr;
        </Button>
        <span className="bg-muted rounded px-3 py-1 text-sm font-medium">
          {format(month, "MMMM yyyy")}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
        >
          &rarr;
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4" /> On leave today ({outToday.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 rounded" />
            ) : outToday.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">Everyone's in today.</p>
            ) : (
              <div className="divide-y">
                {outToday.map((l) => (
                  <Row key={l.id} l={l} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">This month ({leaves.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 rounded" />
            ) : leaves.length === 0 ? (
              <EmptyState compact title="No approved leave this month." />
            ) : (
              <div className="divide-y">
                {leaves.map((l) => (
                  <div
                    key={l.id}
                    className={cn(isOnLeaveToday(l) && "bg-amber-50/50 dark:bg-amber-950/10")}
                  >
                    <Row l={l} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
