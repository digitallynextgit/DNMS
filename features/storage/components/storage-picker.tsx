"use client"

// Pick a bucket first: an object key means nothing without its bucket, so files are never listed flat.

import * as React from "react"

import { StorageManager } from "./storage-manager"
import { StorageAccountGrid, useStorageAccounts, type StorageAccount } from "./storage-accounts"

export function StoragePicker() {
  const { data, isPending, refetch } = useStorageAccounts()
  const [open, setOpen] = React.useState<StorageAccount | null>(null)

  const accounts = React.useMemo(() => data ?? [], [data])

  // Keep the opened card in step with a rename or default change made while it's open.
  if (open) {
    const fresh = accounts.find((a) => a.id === open.id)
    if (!fresh) setOpen(null)
    else if (fresh.label !== open.label || fresh.bucket !== open.bucket) setOpen(fresh)
  }

  if (open) {
    return (
      <StorageManager
        accountId={open.id}
        accountLabel={open.label}
        onBack={() => {
          setOpen(null)
          refetch()
        }}
      />
    )
  }

  // No PageHeader here: StorageAccountGrid renders it.
  return (
    <StorageAccountGrid
      accounts={accounts}
      isPending={isPending}
      onOpen={setOpen}
      onChanged={refetch}
    />
  )
}
