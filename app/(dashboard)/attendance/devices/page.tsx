"use client"

import { useState } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { Plus, RefreshCw, Pencil, Trash2, Wifi, WifiOff, Zap, History } from "lucide-react"
import { Spinner } from "@/components/shared/spinner"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import { useRowSelection } from "@/hooks/use-row-selection"
import { DeviceFormDialog, EmployeeSyncPanel, SyncProgressBar } from "@/features/attendance"
import { useSyncProgress } from "@/features/attendance"
import { useDevices, useDeleteDevice, useTestDevice } from "@/features/attendance"
import type { HikvisionDevice } from "@/features/attendance"
import { usePermissions } from "@/features/admin"
import { ACTIVE_STATUS_COLORS, ACTIVE_STATUS_LABELS, PERMISSIONS } from "@/lib/constants"
import { formatDateTime } from "@/lib/utils"
import { cn } from "@/lib/utils"

export default function DevicesPage() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.ATTENDANCE_WRITE)

  const { data, isLoading } = useDevices()
  const devices = data?.data ?? []

  const deleteDevice = useDeleteDevice()
  const testDevice = useTestDevice()
  // Streaming sync: gives a real % + ETA instead of an indeterminate spinner.
  const { progress, isRunning, start: startSync, cancel: cancelSync } = useSyncProgress()

  // Client-side pagination (devices is a small, full-list config resource).
  const PAGE_SIZE = 10
  const [page, setPage] = useUrlPage()
  const totalPages = Math.max(1, Math.ceil(devices.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedDevices = devices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const selection = useRowSelection(pagedDevices.map((d) => d.id))

  const [formOpen, setFormOpen] = useState(false)
  const [editDevice, setEditDevice] = useState<HikvisionDevice | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [fullSyncId, setFullSyncId] = useState<string | null>(null)

  function handleEdit(device: HikvisionDevice) {
    setEditDevice(device)
    setFormOpen(true)
  }

  async function handleSync(id: string) {
    setSyncingId(id)
    try {
      await startSync(id)
    } finally {
      setSyncingId(null)
    }
  }

  // Full re-sync: rebuild every day from the device (from each employee's joining
  // date), overwriting device rows. Fixes historical data captured wrong before
  // a sync-logic fix; HR manual corrections are always preserved.
  async function handleFullSync(id: string) {
    setSyncingId(id)
    try {
      await startSync(id, { full: true })
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

  async function handleBulkDelete() {
    for (const id of selection.selectedIds) {
      await deleteDevice.mutateAsync(id)
    }
    selection.clear()
    setBulkOpen(false)
  }

  const columns: DataTableColumn<HikvisionDevice>[] = [
    {
      header: "Name",
      className: "font-medium",
      cell: (device) => device.name,
    },
    {
      header: "Serial",
      className: "text-muted-foreground font-mono text-xs",
      cell: (device) => device.deviceSerial,
    },
    {
      header: "IP Address",
      className: "text-muted-foreground",
      cell: (device) => `${device.ipAddress}:${device.port}`,
    },
    {
      header: "Location",
      className: "text-muted-foreground",
      cell: (device) => device.location ?? "-",
    },
    {
      header: "Status",
      cell: (device) => (
        <StatusBadge
          status={device.isActive ? "ACTIVE" : "INACTIVE"}
          colorMap={ACTIVE_STATUS_COLORS}
          labelMap={ACTIVE_STATUS_LABELS}
          icon={device.isActive ? Wifi : WifiOff}
        />
      ),
    },
    {
      header: "Last Sync",
      className: "text-muted-foreground text-xs",
      cell: (device) => (device.lastSyncAt ? formatDateTime(device.lastSyncAt) : "Never"),
    },
    ...(canWrite
      ? [
          {
            header: "Actions",
            align: "right" as const,
            cell: (device: HikvisionDevice) => (
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
                    <Spinner size="sm" />
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
                  disabled={syncingId === device.id || !device.isActive}
                  title="Sync device"
                >
                  {syncingId === device.id ? (
                    <Spinner size="sm" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Sync
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setFullSyncId(device.id)}
                  disabled={syncingId === device.id || !device.isActive}
                  title="Full re-sync (rebuild all history from device)"
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleEdit(device)}
                  title="Edit device"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(device.id)}
                  title="Delete device"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

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

      {canWrite && (
        <BulkActionBar count={selection.count} onClear={selection.clear}>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkOpen(true)}
            disabled={deleteDevice.isPending}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </BulkActionBar>
      )}

      {/* Live sync progress: real % (the server knows the total window count before
          it starts), elapsed timer and a measured ETA. Rendered above the table so it
          stays visible for the whole run, which can be minutes on a full backfill. */}
      <SyncProgressBar progress={progress} onCancel={cancelSync} />

      {/* The table renders from the first paint: while `isLoading` it draws
          skeleton rows inside its own real <thead>, derived from `columns`, so
          the column count follows `canWrite` instead of being hand-counted. */}
      {isLoading || devices.length > 0 ? (
        <DataTable
          columns={columns}
          rows={pagedDevices}
          rowKey={(d) => d.id}
          minWidth="min-w-[820px]"
          showSerial
          serialOffset={(currentPage - 1) * PAGE_SIZE}
          selection={canWrite ? selection : undefined}
          loading={isLoading}
          skeletonRows={4}
        />
      ) : (
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
      )}

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        total={devices.length}
        onPageChange={setPage}
        itemLabel="device"
      />

      {/* Per-employee sync + attendance summary */}
      {canWrite && devices.length > 0 && (
        <EmployeeSyncPanel
          devices={devices.map((d) => ({ id: d.id, name: d.name, isActive: d.isActive }))}
        />
      )}

      {/* Add / Edit dialog */}
      <DeviceFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditDevice(null)
        }}
        editDevice={editDevice}
      />

      {/* Bulk delete confirmation */}
      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Delete ${selection.count} device${selection.count === 1 ? "" : "s"}?`}
        description="The selected devices will be permanently deleted. Existing attendance logs linked to them are kept."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleBulkDelete}
        isLoading={deleteDevice.isPending}
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

      {/* Full re-sync confirmation */}
      <ConfirmDialog
        open={!!fullSyncId}
        onOpenChange={(open) => !open && setFullSyncId(null)}
        title="Full re-sync from device?"
        description="Rebuilds attendance for every active employee from the device, back to their joining date. Device-synced rows are overwritten with the device's data (fixing any wrong days); HR manual corrections are always kept. Must run on the office network, and may take a while."
        confirmLabel="Full re-sync"
        isLoading={isRunning}
        onConfirm={async () => {
          const id = fullSyncId
          if (!id) return
          setFullSyncId(null)
          await handleFullSync(id)
        }}
      />
    </div>
  )
}
