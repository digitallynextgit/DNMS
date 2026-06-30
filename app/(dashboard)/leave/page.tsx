"use client"

import { useState } from "react"
import { useUrlPage, useUrlState } from "@/hooks/use-url-state"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { EmptyState } from "@/components/shared/empty-state"
import { CardGridSkeleton, ListSkeleton } from "@/components/shared/loading-skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { LeaveBalanceCard } from "@/features/leave"
import { LeaveRequestTable } from "@/features/leave"
import { useLeaveBalances, useMyLeaveRequests, useMyTeamLeaveRequests } from "@/features/leave"
import { Plus } from "lucide-react"

export default function LeaveDashboardPage() {
  const { data: session } = useSession()
  const currentYear = new Date().getFullYear()
  const [page, setPage] = useUrlPage()
  const [tab, setTab] = useUrlState("tab", "my-leaves")
  const [teamPage, setTeamPage] = useState(1)

  const { data: balancesData, isLoading: balancesLoading } = useLeaveBalances(
    undefined,
    currentYear,
  )
  const { data: requestsData, isLoading: requestsLoading } = useMyLeaveRequests({
    page,
    limit: 10,
  })
  // Direct reports' requests - drives the manager tab (only shown when isManager).
  const { data: team, isLoading: teamLoading } = useMyTeamLeaveRequests({
    page: teamPage,
    limit: 10,
  })

  const balances = balancesData?.data ?? []
  const requests = requestsData?.data ?? []
  const pagination = requestsData?.pagination
  const isManager = team?.isManager ?? false

  const applyButton = (
    <Button asChild>
      <Link href="/leave/apply" className="flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Apply Leave
      </Link>
    </Button>
  )

  // The "My Leaves" view: balances + the employee's own recent requests.
  const myLeaves = (
    <>
      <section className="space-y-4">
        <h2 className="text-foreground text-base font-semibold">Leave Balances - {currentYear}</h2>
        {balancesLoading ? (
          <CardGridSkeleton count={4} />
        ) : balances.length === 0 ? (
          <EmptyState
            variant="card"
            title="No paid leave is available yet."
            description="Paid leave is allocated once your probation is complete. You can still apply for unpaid leave (Leave Without Pay)."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {balances.map((balance) => (
              <LeaveBalanceCard key={balance.id} balance={balance} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-base font-semibold">Recent Requests</h2>
        {requestsLoading ? (
          <ListSkeleton rows={4} height="h-14" />
        ) : (
          <>
            <LeaveRequestTable
              requests={requests}
              showEmployee={false}
              canApprove={false}
              currentUserId={session?.user.id}
            />
            {pagination && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                onPageChange={setPage}
                itemLabel="request"
              />
            )}
          </>
        )}
      </section>
    </>
  )

  // Non-managers see the plain My Leave view (no tabs).
  if (!isManager) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="My Leave"
          description="View your leave balances and recent requests."
          actions={applyButton}
        />
        {myLeaves}
      </div>
    )
  }

  // Managers get a "My Leaves" / "Leave Requests" (their team) tab set.
  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <PageHeader
          title="My Leave"
          description="Your leave, and the leave requests from your team."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <TabsList>
                <TabsTrigger value="my-leaves">My Leaves</TabsTrigger>
                <TabsTrigger value="requests">Leave Requests</TabsTrigger>
              </TabsList>
              {applyButton}
            </div>
          }
        />

        <TabsContent value="my-leaves" className="space-y-8">
          {myLeaves}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          {teamLoading ? (
            <ListSkeleton rows={6} height="h-14" />
          ) : (
            <>
              <LeaveRequestTable
                requests={team?.requests ?? []}
                showEmployee
                canApprove
                currentUserId={session?.user.id}
              />
              {team?.pagination && team.pagination.total > 0 && (
                <Pagination
                  page={team.pagination.page}
                  totalPages={team.pagination.totalPages}
                  total={team.pagination.total}
                  onPageChange={setTeamPage}
                  itemLabel="request"
                />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
