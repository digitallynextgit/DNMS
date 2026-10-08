"use client"

import { useState } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  WifiOff,
  Power,
  PowerOff,
  Zap,
  History,
} from "lucide-react"
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
import {
  DeviceFormDialog,
  EmployeeSyncPanel,
  RealtimePushPanel,
  SyncProgressBar,
} from "@/features/attendance"
import { useSyncProgress } from "@/features/attendance"
import { useDevices, useDeleteDevice, useTestDevice } from "@/features/attendance"
import type { HikvisionDevice } from "@/features/attendance"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { ACTIVE_STATUS_COLORS, PERMISSIONS } from "@/lib/constants"
import { formatDateTime } from "@/lib/utils"

export default function DevicesPage() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.ATTENDANCE_WRITE)

  const { data, isLoading } = useDevices()
  const devices = data?.data ?? []

  const deleteDevice = useDeleteDevice()
  const testDevice = useTestDevice()
  const { progress, isRunning, start: startSync, cancel: cancelSync } = useSyncProgress()

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

  // Rebuilds every day from the device (from each joining date), overwriting device rows.
  // HR manual corrections are always preserved.
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
    try {
      for (const id of selection.selectedIds) {
        await deleteDevice.mutateAsync(id)
      }
      selection.clear()
      setBulkOpen(false)
    } catch {
      // the mutation hook already toasts the error; just keep the form open
    }
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
      // "Enabled", not "Active": isActive means "DNMS should poll this device", not that it's
      // reachable now. The Test button answers reachability.
      header: "Enabled",
      cell: (device) => (
        <StatusBadge
          status={device.isActive ? "ACTIVE" : "INACTIVE"}
          colorMap={ACTIVE_STATUS_COLORS}
          labelMap={{ ACTIVE: "Enabled", INACTIVE: "Disabled" }}
          icon={device.isActive ? Power : PowerOff}
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
                  className="gap-1.5"
                  variant="outline"
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
                  className="gap-1.5"
                  variant="outline"
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
                  size="icon"
                  onClick={() => setFullSyncId(device.id)}
                  disabled={syncingId === device.id || !device.isActive}
                  title="Full re-sync (rebuild all history from device)"
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(device)}
                  title="Edit device"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
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
              className="gap-2"
              onClick={() => {
                setEditDevice(null)
                setFormOpen(true)
              }}
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
            onClick={() => setBulkOpen(true)}
            disabled={deleteDevice.isPending}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </BulkActionBar>
      )}

      {/* Above the table so it stays visible for the whole run (minutes on a full backfill). */}
      <SyncProgressBar progress={progress} onCancel={cancelSync} />

      {canWrite && <RealtimePushPanel />}

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

      {canWrite && devices.length > 0 && (
        <EmployeeSyncPanel
          devices={devices.map((d) => ({ id: d.id, name: d.name, isActive: d.isActive }))}
        />
      )}

      <DeviceFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditDevice(null)
        }}
        editDevice={editDevice}
      />

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
