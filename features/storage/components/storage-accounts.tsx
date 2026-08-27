"use client"

/**
 * The storage picker: one card per connected bucket, then the full contents of
 * whichever you open.
 *
 * These credentials used to be a single block on the Integrations page, which
 * could only ever describe one bucket. They live here now, next to the files
 * they explain.
 */

import * as React from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { HardDrive, Plus } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { ViewToggle, useViewMode } from "@/components/shared/view-toggle"
import { AccountCard, AccountTable } from "./storage-account-views"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface StorageAccount {
  id: string
  label: string
  endpoint: string
  region: string
  bucket: string
  keyId: string
  isDefault: boolean
  isActive: boolean
  lastVerifiedAt: string | null
  lastError: string | null
}

export function useStorageAccounts() {
  return useQuery({
    queryKey: ["storage-accounts"],
    queryFn: async () =>
      (await apiFetch<{ data: { data: StorageAccount[] } }>("/api/admin/storage-accounts")).data
        .data,
  })
}

export function StorageAccountGrid({
  accounts,
  isPending,
  onOpen,
  onChanged,
}: {
  accounts: StorageAccount[]
  isPending: boolean
  onOpen: (a: StorageAccount) => void
  onChanged: () => void
}) {
  const [editing, setEditing] = React.useState<StorageAccount | "new" | null>(null)
  const [removing, setRemoving] = React.useState<StorageAccount | null>(null)
  const [testingId, setTestingId] = React.useState<string | null>(null)
  const [view, setView] = useViewMode("storage-accounts-view", "card")

  const test = useMutation({
    mutationFn: (a: StorageAccount) =>
      apiFetch(`/api/admin/storage-accounts/${a.id}/test`, { method: "POST" }),
    onMutate: (a) => setTestingId(a.id),
    onSuccess: (_d, a) => {
      toast.success(`${a.label} is reachable`)
      onChanged()
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setTestingId(null),
  })

  const makeDefault = useMutation({
    mutationFn: (a: StorageAccount) =>
      apiFetch(`/api/admin/storage-accounts/${a.id}/default`, { method: "POST" }),
    onSuccess: (_d, a) => {
      toast.success(`New uploads will go to ${a.label}`)
      onChanged()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (a: StorageAccount) =>
      apiFetch(`/api/admin/storage-accounts/${a.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Storage removed. The bucket and its files are untouched.")
      setRemoving(null)
      onChanged()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      {/* The grid owns the page header, so the view toggle and the primary action
          sit on the title line - the same arrangement as the Projects page. The
          old helper paragraph is gone: the "Default" badge on the card already
          says which bucket new uploads go to, and a line of prose repeating it
          was pushing the controls onto a row of their own. */}
      <PageHeader
        title="Storage"
        description="Buckets connected to DNMS. Open one to browse its files."
        actions={
          <div className="flex items-center gap-2">
            <ViewToggle value={view} onChange={setView} />
            <Button className="gap-2" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" />
              Add storage
            </Button>
          </div>
        }
      />

      {isPending && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-52 rounded-sm" />
          ))}
        </div>
      )}

      {!isPending && accounts.length === 0 && (
        <EmptyState
          icon={HardDrive}
          title="No storage connected"
          description="Add a Backblaze B2 (or any S3-compatible) bucket to start storing files."
          variant="card"
        />
      )}

      {!isPending && accounts.length > 0 && view === "card" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              busy={testingId === a.id}
              onOpen={onOpen}
              onEdit={setEditing}
              onRemove={setRemoving}
              onTest={test.mutate}
              onMakeDefault={makeDefault.mutate}
            />
          ))}
        </div>
      )}

      {!isPending && accounts.length > 0 && view === "table" && (
        <AccountTable
          accounts={accounts}
          testingId={testingId}
          onOpen={onOpen}
          onEdit={setEditing}
          onRemove={setRemoving}
          onTest={test.mutate}
          onMakeDefault={makeDefault.mutate}
        />
      )}

      {editing && (
        <AccountDialog
          account={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            onChanged()
          }}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this storage?"
        description={
          removing
            ? `"${removing.label}" is disconnected from DNMS. The bucket and everything in it stay exactly as they are - this only removes the credentials.`
            : ""
        }
        confirmLabel="Remove"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  )
}

/** The same form for adding and editing - one shape to learn. */
function AccountDialog({
  account,
  onClose,
  onDone,
}: {
  account: StorageAccount | null
  onClose: () => void
  onDone: () => void
}) {
  const editing = !!account
  const [label, setLabel] = React.useState(account?.label ?? "")
  const [endpoint, setEndpoint] = React.useState(
    account?.endpoint ?? "https://s3.us-east-005.backblazeb2.com",
  )
  const [region, setRegion] = React.useState(account?.region ?? "us-east-005")
  const [bucket, setBucket] = React.useState(account?.bucket ?? "")
  const [keyId, setKeyId] = React.useState(account?.keyId ?? "")
  const [appKey, setAppKey] = React.useState("")
  const [isActive, setIsActive] = React.useState(account?.isActive ?? true)

  const save = useMutation({
    mutationFn: () =>
      apiFetch(
        editing ? `/api/admin/storage-accounts/${account.id}` : "/api/admin/storage-accounts",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, endpoint, region, bucket, keyId, appKey, isActive }),
        },
      ),
    onSuccess: () => {
      toast.success(editing ? "Storage updated" : "Storage connected")
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg lg:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">{editing ? "Edit storage" : "Add storage"}</DialogTitle>
          <DialogDescription className="text-xs">
            Backblaze B2, or any S3-compatible bucket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Name<span className="text-destructive"> *</span>
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Backblaze B2 · main"
              aria-label="Backblaze B2 · main"
              className="h-9 text-sm"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Endpoint<span className="text-destructive"> *</span>
              </Label>
              <Input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Region<span className="text-destructive"> *</span>
              </Label>
              <Input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Bucket<span className="text-destructive"> *</span>
              </Label>
              <Input
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Key ID<span className="text-destructive"> *</span>
              </Label>
              <Input
                value={keyId}
                onChange={(e) => setKeyId(e.target.value)}
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Application key{!editing && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              type="password"
              value={appKey}
              onChange={(e) => setAppKey(e.target.value)}
              placeholder={editing ? "Leave blank to keep the stored key" : ""}
              className="h-9 font-mono text-xs"
            />
            <p className="text-muted-foreground text-[11px]">
              Encrypted at rest and never shown again - the same handling as SMTP passwords.
            </p>
          </div>

          <label className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-muted-foreground text-xs">
              {isActive ? "Available for use" : "Switched off"}
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-9 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="h-9 text-xs"
            disabled={
              label.trim().length < 2 ||
              !endpoint.trim() ||
              !bucket.trim() ||
              !keyId.trim() ||
              (!editing && !appKey.trim()) ||
              save.isPending
            }
            onClick={() => save.mutate()}
          >
            {editing ? "Save changes" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
