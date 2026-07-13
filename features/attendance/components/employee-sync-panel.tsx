"use client"

import { useState } from "react"
import { toast } from "sonner"
import { RefreshCw, History, Loader2, Search, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import {
  useEmployeeSyncSummary,
  useSyncDevice,
  type EmployeeSyncSummary,
} from "@/features/attendance"

interface DeviceOption {
  id: string
  name: string
  isActive: boolean
}

export function EmployeeSyncPanel({ devices }: { devices: DeviceOption[] }) {
  const activeDevices = devices.filter((d) => d.isActive)
  const { data, isLoading } = useEmployeeSyncSummary()
  const syncDevice = useSyncDevice()

  const [deviceId, setDeviceId] = useState(activeDevices[0]?.id ?? "")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  // Every employeeNo currently syncing. A Set (not a single value) so multiple
  // rows can sync at once and each keeps its own spinner until IT finishes,
  // regardless of what else you click.
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const rows = data?.data ?? []
  const q = search.trim().toLowerCase()
  const filtered = q
    ? rows.filter((r) =>
        `${r.firstName ?? ""} ${r.lastName ?? ""} ${r.employeeNo} ${r.deviceId ?? ""}`
          .toLowerCase()
          .includes(q),
      )
    : rows

  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const targetDevice = deviceId || activeDevices[0]?.id || ""

  async function run(employeeNo: string, full: boolean) {
    if (!targetDevice) {
      toast.error("No active device to sync from")
      return
    }
    setBusy((prev) => new Set(prev).add(employeeNo))
    try {
      await syncDevice.mutateAsync({ id: targetDevice, employeeNo, full })
    } finally {
      setBusy((prev) => {
        const next = new Set(prev)
        next.delete(employeeNo)
        return next
      })
    }
  }

  const columns: DataTableColumn<EmployeeSyncSummary>[] = [
    {
      header: "Employee",
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <AvatarDisplay
            src={r.profilePhoto}
            firstName={r.firstName ?? ""}
            lastName={r.lastName ?? ""}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {r.firstName} {r.lastName}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {r.employeeNo}
              {r.designation ? ` · ${r.designation}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: "Device ID",
      className: "tabular-nums",
      cell: (r) =>
        r.deviceId ?? <span className="text-amber-600 dark:text-amber-500">No code</span>,
    },
    { header: "Logged", align: "right", className: "tabular-nums", cell: (r) => r.totalDays },
    { header: "Present", align: "right", className: "tabular-nums", cell: (r) => r.presentDays },
    { header: "Half", align: "right", className: "tabular-nums", cell: (r) => r.halfDays },
    {
      header: "Last punch",
      className: "text-muted-foreground tabular-nums",
      cell: (r) => r.lastPunchDate ?? "Never",
    },
    {
      header: "Actions",
      align: "right",
      cell: (r) => {
        const rowBusy = busy.has(r.employeeNo)
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              disabled={!r.hasCode || rowBusy || !targetDevice}
              onClick={() => run(r.employeeNo, false)}
              title="Sync new days for this employee"
            >
              {rowBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sync
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!r.hasCode || rowBusy || !targetDevice}
              onClick={() => run(r.employeeNo, true)}
              title="Full re-sync this employee's history from the device"
            >
              <History className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Users className="h-4 w-4" />
          Sync by employee
        </h2>
        {activeDevices.length > 1 && (
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground text-xs">Device</Label>
            <Select value={targetDevice} onValueChange={setDeviceId}>
              <SelectTrigger className="h-8 w-56">
                <SelectValue placeholder="Select device" />
              </SelectTrigger>
              <SelectContent>
                {activeDevices.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        Sync one person at a time (fast). <strong>Sync</strong> pulls new days since the last device
        sync; <strong>Full</strong> rebuilds their whole history from the device (manual corrections
        kept). Runs against{" "}
        {activeDevices.length <= 1
          ? (activeDevices[0]?.name ?? "the device")
          : "the selected device"}
        .
      </p>

      <div className="relative max-w-xs">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search employee…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="h-9 pl-8"
        />
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} height="h-12" />
      ) : filtered.length === 0 ? (
        <EmptyState variant="card" title="No employees found." />
      ) : (
        <DataTable
          columns={columns}
          rows={paged}
          rowKey={(r) => r.id}
          showSerial
          serialOffset={(currentPage - 1) * PAGE_SIZE}
          minWidth="min-w-[720px]"
          pagination={{
            page: currentPage,
            totalPages,
            total: filtered.length,
            onPageChange: setPage,
            itemLabel: "employee",
          }}
        />
      )}
    </div>
  )
}
