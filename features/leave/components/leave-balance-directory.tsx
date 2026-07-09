"use client"

import { useState } from "react"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { useUpdateEffect } from "@/hooks/use-update-effect"
import { cn } from "@/lib/utils"
import type {
  EmployeeLeaveBalances,
  LeaveType,
  LeaveBalance,
} from "@/features/leave/hooks/use-leave"

const PAGE_SIZE = 10

// Available now = accrued + carried − used − pending; annual entitlement = allocated + carried.
// Mirrors the per-type LeaveBalanceCard so the numbers agree across the app.
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
}

/** HR matrix (one row per employee, one column per leave type) built on the shared
 *  DataTable, so it gets S.No, pagination, and the app's table styling for free. */
export function LeaveBalanceDirectory({ employees, leaveTypes }: Props) {
  const types = leaveTypes.filter((t) => t.isActive)
  const [page, setPage] = useState(1)

  const total = employees.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // Reset to page 1 when the filtered set size changes (e.g. a search narrows it).
  useUpdateEffect(() => setPage(1), [total])
  const paged = employees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns: DataTableColumn<EmployeeLeaveBalances>[] = [
    {
      header: "Employee",
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
    ...types.map<DataTableColumn<EmployeeLeaveBalances>>((t) => ({
      header: (
        <span className="whitespace-nowrap">
          {t.name} <span className="text-muted-foreground/70 normal-case">({t.code})</span>
        </span>
      ),
      align: "center",
      cell: (emp) => {
        const cell = computeCell(emp.leaveBalances.find((b) => b.leaveTypeId === t.id))
        if (!cell) return <span className="text-muted-foreground/40">—</span>
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
            <span className="text-muted-foreground text-[11px] whitespace-nowrap">
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
      cell: (emp) => {
        const totalLeft = types.reduce((sum, t) => {
          const c = computeCell(emp.leaveBalances.find((b) => b.leaveTypeId === t.id))
          return sum + (c?.available ?? 0)
        }, 0)
        return <span className="font-semibold tabular-nums">{totalLeft}</span>
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={paged}
      rowKey={(e) => e.id}
      showSerial
      serialOffset={(page - 1) * PAGE_SIZE}
      minWidth="min-w-[720px]"
      pagination={{ page, totalPages, total, onPageChange: setPage, itemLabel: "employee" }}
    />
  )
}
