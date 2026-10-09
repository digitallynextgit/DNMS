"use client"

import type { ReactNode } from "react"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { cn } from "@/lib/utils"
import type {
  EmployeeLeaveBalances,
  LeaveType,
  LeaveBalance,
} from "@/features/leave/hooks/use-leave"

// Available now = accrued + carried − used − pending; annual entitlement = allocated + carried.
function computeCell(bal?: LeaveBalance) {
  if (!bal) return null
  const allocated = Number(bal.allocated) || 0
  const accrued = Number(bal.accrued) || 0
  const carried = Number(bal.carried) || 0
  const used = Number(bal.used) || 0
  const pending = Number(bal.pending) || 0
  return {
    total: allocated + carried,
    available: Math.max(0, accrued + carried - used - pending),
    used,
    pending,
  }
}

interface Props {
  employees: EmployeeLeaveBalances[]
  leaveTypes: LeaveType[]
  loading?: boolean
  /** The balance year, for the export file name. */
  year?: number
  /** Changes with the search or year, so the table returns to page 1. */
  pageKey?: string
  toolbar?: ReactNode
  empty?: ReactNode
}

/** HR matrix: one row per employee, one column per leave type, on the shared DataTable. */
export function LeaveBalanceDirectory({
  employees,
  leaveTypes,
  loading,
  year,
  pageKey,
  toolbar,
  empty,
}: Props) {
  const types = leaveTypes.filter((t) => t.isActive)
  const cellFor = (emp: EmployeeLeaveBalances, typeId: string) =>
    computeCell(emp.leaveBalances.find((b) => b.leaveTypeId === typeId))
  const totalLeft = (emp: EmployeeLeaveBalances) =>
    types.reduce((sum, t) => sum + (cellFor(emp, t.id)?.available ?? 0), 0)

  const columns: DataTableColumn<EmployeeLeaveBalances>[] = [
    {
      header: "Employee",
      sortValue: (emp) => `${emp.firstName} ${emp.lastName}`.trim(),
      cell: (emp) => (
        <div className="flex items-center gap-2">
          <AvatarDisplay
            src={emp.profilePhoto}
            firstName={emp.firstName}
            lastName={emp.lastName}
            size="sm"
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {emp.firstName} {emp.lastName}
            </p>
            <p className="text-muted-foreground text-xs">{emp.employeeNo}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Employee No",
      defaultHidden: true,
      sortValue: (emp) => emp.employeeNo,
      className: "font-mono text-xs",
      cell: (emp) => emp.employeeNo,
    },
    ...types.map<DataTableColumn<EmployeeLeaveBalances>>((t) => ({
      // A text header, so the column picker and Export can name it.
      header: `${t.name} (${t.code})`,
      key: t.id,
      align: "center",
      sortValue: (emp) => cellFor(emp, t.id)?.available,
      cell: (emp) => {
        const cell = cellFor(emp, t.id)
        if (!cell) return <span className="text-muted-foreground/40">-</span>
        return (
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "font-semibold tabular-nums",
                cell.available === 0 && "text-muted-foreground",
              )}
            >
              {cell.available}
            </span>
            <span className="text-muted-foreground text-[11px]">
              of {cell.total} · used {cell.used}
              {cell.pending > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {" "}
                  · {cell.pending} pending
                </span>
              )}
            </span>
          </div>
        )
      },
    })),
    {
      header: "Total left",
      align: "center",
      sortValue: totalLeft,
      cell: (emp) => <span className="font-semibold tabular-nums">{totalLeft(emp)}</span>,
    },
  ]

  return (
    <DataTable
      tableId="leave-balances"
      exportName={year ? `leave-balances-${year}` : "leave-balances"}
      itemLabel="employee"
      columns={columns}
      rows={employees}
      rowKey={(e) => e.id}
      showSerial
      minWidth="min-w-[720px]"
      loading={loading}
      skeletonRows={6}
      pageKey={pageKey}
      toolbar={toolbar}
      empty={empty}
    />
  )
}
