"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { EmptyState } from "@/components/shared/empty-state"
import { CardGridSkeleton, ListSkeleton } from "@/components/shared/loading-skeleton"
import { LeaveBalanceCard } from "@/features/leave"
import { LeaveRequestTable } from "@/features/leave"
import { useLeaveBalances, useMyLeaveRequests } from "@/features/leave"
import { Plus } from "lucide-react"

export default function LeaveDashboardPage() {
  const { data: session } = useSession()
  const currentYear = new Date().getFullYear()
  const [page, setPage] = useState(1)

  const { data: balancesData, isLoading: balancesLoading } = useLeaveBalances(
    undefined,
    currentYear,
  )
  const { data: requestsData, isLoading: requestsLoading } = useMyLeaveRequests({
    page,
    limit: 10,
  })

  const balances = balancesData?.data ?? []
  const requests = requestsData?.data ?? []
  const pagination = requestsData?.pagination

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Leave"
        description="View your leave balances and recent requests."
        actions={
          <Button asChild>
            <Link href="/leave/apply" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Apply Leave
            </Link>
          </Button>
        }
      />

      {/* Leave Balances */}
      <section className="space-y-4">
        <h2 className="text-foreground text-base font-semibold">Leave Balances - {currentYear}</h2>

        {balancesLoading ? (
          <CardGridSkeleton count={4} />
        ) : balances.length === 0 ? (
          <EmptyState
            variant="card"
            title={`No leave balances have been allocated for ${currentYear}.`}
            description="Contact your HR administrator to set up your leave balance."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {balances.map((balance) => (
              <LeaveBalanceCard key={balance.id} balance={balance} />
            ))}
          </div>
        )}
      </section>

      {/* Recent Requests */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-base font-semibold">Recent Requests</h2>
        </div>

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
    </div>
  )
}
