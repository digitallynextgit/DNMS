"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { UserPlus } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { TableSearch } from "@/components/shared/table-search"
import { TabsBar } from "@/components/shared/tabs-bar"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { useDebounce } from "@/hooks/use-debounce"
import { useUrlPage, useUrlState } from "@/hooks/use-url-state"
import { useTenantPath } from "@/components/tenant-link"
import { PERMISSIONS, CHECKLIST_STATUS_COLORS, CHECKLIST_STATUS_LABELS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import {
  ChecklistProgressBar,
  useChecklists,
  type ChecklistListRow,
} from "@/features/hr-checklists"

export default function OnboardingPage() {
  const router = useRouter()
  const tp = useTenantPath()
  const { can } = usePermissions()
  const canRead = can(PERMISSIONS.ONBOARDING_READ) || can(PERMISSIONS.ONBOARDING_WRITE)

  const [status, setStatus] = useUrlState("status", "IN_PROGRESS")
  const [page, setPage] = useUrlPage()
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = useChecklists("ONBOARDING", {
    status,
    page,
    search: debouncedSearch,
  })
  const rows = data?.data ?? []
  const pagination = data?.pagination

  const columns: DataTableColumn<ChecklistListRow>[] = [
    {
      header: "Employee",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <AvatarDisplay
            firstName={row.employee.firstName}
            lastName={row.employee.lastName}
            src={row.employee.profilePhoto}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {row.employee.firstName} {row.employee.lastName}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {row.employee.designation?.title ?? row.employee.employeeNo}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: "Progress",
      className: "w-56",
      cell: (row) => <ChecklistProgressBar progress={row.progress} showClearances={false} />,
    },
    {
      header: "Joined",
      cell: (row) => <span className="text-xs">{formatDate(row.anchorDate)}</span>,
    },
    {
      header: "Status",
      cell: (row) => (
        <StatusBadge
          status={row.status}
          colorMap={CHECKLIST_STATUS_COLORS}
          labelMap={CHECKLIST_STATUS_LABELS}
          size="xs"
        />
      ),
    },
  ]

  if (!canRead) {
    return (
      <div className="text-muted-foreground p-6 text-sm">
        You do not have permission to view onboarding checklists.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs value={status} onValueChange={setStatus} className="space-y-6">
        <PageHeader
          title="Onboarding"
          description="Every joiner's checklist, from the week before they start to their first-month review."
          actions={
            <TabsBar
              spacing="none"
              items={[
                { value: "IN_PROGRESS", label: "In progress" },
                { value: "COMPLETED", label: "Completed" },
                { value: "ALL", label: "All" },
              ]}
            />
          }
        />

        <TabsContent value={status} className="space-y-6">
          {/* Kept while searching, so the search box stays reachable when nothing matches. */}
          {isLoading || rows.length > 0 || search ? (
            <DataTable
              tableId="onboarding"
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={(row) => router.push(tp(`/onboarding/${row.id}`))}
              loading={isLoading}
              skeletonRows={8}
              serialOffset={pagination ? (pagination.page - 1) * pagination.limit : 0}
              toolbar={
                <TableSearch
                  value={search}
                  onChange={(v) => {
                    setSearch(v)
                    setPage(1)
                  }}
                  placeholder="Search name or number"
                  label="Search by name or employee number"
                />
              }
              empty="No one matches that search."
              pagination={
                pagination
                  ? {
                      page: pagination.page,
                      totalPages: pagination.totalPages,
                      total: pagination.total,
                      onPageChange: setPage,
                      itemLabel: "checklist",
                      pageSize: pagination.limit,
                    }
                  : undefined
              }
            />
          ) : (
            <EmptyState
              icon={UserPlus}
              variant="card"
              title="No onboarding checklists here"
              description="One is started automatically whenever an employee is created."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
