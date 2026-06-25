"use client"

import { useState } from "react"
import { Plus, RefreshCw, Pencil, Trash2, Wifi, WifiOff, Loader2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { TableSkeleton } from "@/components/shared/loading-skeleton"
import { DeviceFormDialog } from "@/features/attendance"
import { useDevices, useDeleteDevice, useSyncDevice, useTestDevice } from "@/features/attendance"
import type { HikvisionDevice } from "@/features/attendance"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { formatDateTime } from "@/lib/utils"
import { cn } from "@/lib/utils"

export default function DevicesPage() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.ATTENDANCE_WRITE)

  const { data, isLoading } = useDevices()
  const devices = data?.data ?? []

  const deleteDevice = useDeleteDevice()
  const syncDevice = useSyncDevice()
  const testDevice = useTestDevice()

  // Client-side pagination (devices is a small, full-list config resource).
  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(devices.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedDevices = devices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const [formOpen, setFormOpen] = useState(false)
  const [editDevice, setEditDevice] = useState<HikvisionDevice | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  function handleEdit(device: HikvisionDevice) {
    setEditDevice(device)
    setFormOpen(true)
  }

  async function handleSync(id: string) {
    setSyncingId(id)
    try {
      await syncDevice.mutateAsync(id)
    } finally {
      setSyncingId(null)
    }
  }

  async function handleTest(id: string) {
    setTestingId(id)
    try {
      await testDevice.mutateAsync(id)
    } finally {
      setTestingId(null)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteId) return
    await deleteDevice.mutateAsync(deleteId)
    setDeleteId(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hikvision Devices"
        description="Manage attendance capture devices and sync records"
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setEditDevice(null)
                setFormOpen(true)
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Device
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="bg-card rounded border">
          <TableSkeleton rows={4} cols={7} />
        </div>
      ) : devices.length === 0 ? (
        <EmptyState
          variant="card"
          icon={WifiOff}
          title="No devices configured yet."
          action={
            canWrite
              ? {
                  label: "Add First Device",
                  onClick: () => {
                    setEditDevice(null)
                    setFormOpen(true)
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="bg-card rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Name</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Serial</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                  IP Address
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Location</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Last Sync</th>
                {canWrite && (
                  <th className="text-muted-foreground px-4 py-3 text-right font-medium">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagedDevices.map((device) => {
                const isSyncing = syncingId === device.id

                return (
                  <tr key={device.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{device.name}</td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {device.deviceSerial}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {device.ipAddress}:{device.port}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">{device.location ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                          device.isActive
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {device.isActive ? (
                          <Wifi className="h-3 w-3" />
                        ) : (
                          <WifiOff className="h-3 w-3" />
                        )}
                        {device.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {device.lastSyncAt ? formatDateTime(device.lastSyncAt) : "Never"}
                    </td>
                    {canWrite && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => handleTest(device.id)}
                            disabled={testingId === device.id || !device.isActive}
                            title="Test connection"
                          >
                            {testingId === device.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Zap className="h-3.5 w-3.5" />
                            )}
                            Test
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => handleSync(device.id)}
                            disabled={isSyncing || !device.isActive}
                            title="Sync device"
                          >
                            {isSyncing ? (
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
                            onClick={() => handleEdit(device)}
                            title="Edit device"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-8 w-8"
                            onClick={() => setDeleteId(device.id)}
                            title="Delete device"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        total={devices.length}
        onPageChange={setPage}
        itemLabel="device"
      />

      {/* Add / Edit dialog */}
      <DeviceFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditDevice(null)
        }}
        editDevice={editDevice}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Device"
        description="This will permanently delete this device. Existing attendance logs linked to this device will not be deleted."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        isLoading={deleteDevice.isPending}
      />
    </div>
  )
}
