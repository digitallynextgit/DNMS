"use client"

import { useState } from "react"
import { toast } from "sonner"
import { RefreshCw, History, Users } from "lucide-react"
import { Spinner } from "@/components/shared/spinner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { TableSearch } from "@/components/shared/table-search"
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
  // A Set so several rows can sync at once, each keeping its own spinner.
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
      sortValue: (r) => `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(),
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
      sortValue: (r) => r.deviceId,
      cell: (r) =>
        r.deviceId ?? <span className="text-amber-600 dark:text-amber-500">No code</span>,
    },
    {
      header: "Logged",
      align: "right",
      className: "tabular-nums",
      sortValue: (r) => r.totalDays,
      cell: (r) => r.totalDays,
    },
    {
      header: "Present",
      align: "right",
      className: "tabular-nums",
      sortValue: (r) => r.presentDays,
      cell: (r) => r.presentDays,
    },
    {
      header: "Half",
      align: "right",
      className: "tabular-nums",
      sortValue: (r) => r.halfDays,
      cell: (r) => r.halfDays,
    },
    {
      header: "Last punch",
      className: "text-muted-foreground tabular-nums",
      sortValue: (r) => r.lastPunchDate,
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
              className="gap-1.5"
              variant="outline"
              disabled={!r.hasCode || rowBusy || !targetDevice}
              onClick={() => run(r.employeeNo, false)}
              title="Sync new days for this employee"
            >
              {rowBusy ? <Spinner size="sm" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync
            </Button>
            <Button
              variant="ghost"
              size="icon"
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
            <Label required className="text-muted-foreground text-xs">
              Device
            </Label>
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

      <DataTable
        tableId="employee-sync"
        itemLabel="employee"
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        showSerial
        minWidth="min-w-[720px]"
        loading={isLoading}
        skeletonRows={5}
        pageKey={q}
        toolbar={
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Search employee…"
            label="Search employee"
          />
        }
        empty={q ? "No employee matches that search." : "No employees found."}
      />
    </div>
  )
}
