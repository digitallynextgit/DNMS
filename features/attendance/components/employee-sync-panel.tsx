"use client"

import { useState } from "react"
import { toast } from "sonner"
import { RefreshCw, History, Loader2, Search, Users } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useEmployeeSyncSummary, useSyncDevice } from "@/features/attendance"

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
  // `${employeeNo}` currently syncing (both buttons disabled for that row).
  const [busy, setBusy] = useState<string | null>(null)

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
    setBusy(employeeNo)
    try {
      await syncDevice.mutateAsync({ id: targetDevice, employeeNo, full })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Sync by employee
          </CardTitle>
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
          Sync one person at a time (fast). <strong>Sync</strong> pulls new days since the last
          device sync; <strong>Full</strong> rebuilds their whole history from the device (manual
          corrections kept). Runs against{" "}
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
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4">
            <ListSkeleton rows={5} height="h-12" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState variant="card" title="No employees found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/40 border-y">
                <tr className="text-muted-foreground text-left text-xs">
                  <th className="px-4 py-2.5 font-medium">Employee</th>
                  <th className="px-3 py-2.5 font-medium">Device ID</th>
                  <th className="px-3 py-2.5 text-right font-medium">Logged</th>
                  <th className="px-3 py-2.5 text-right font-medium">Present</th>
                  <th className="px-3 py-2.5 text-right font-medium">Half</th>
                  <th className="px-3 py-2.5 font-medium">Last punch</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => {
                  const rowBusy = busy === r.employeeNo
                  return (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5">
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
                      </td>
                      <td className="text-muted-foreground px-3 py-2.5 tabular-nums">
                        {r.deviceId ?? (
                          <span className="text-amber-600 dark:text-amber-500">No code</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.totalDays}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.presentDays}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.halfDays}</td>
                      <td className="text-muted-foreground px-3 py-2.5 tabular-nums">
                        {r.lastPunchDate ?? "Never"}
                      </td>
                      <td className="px-4 py-2.5">
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
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
