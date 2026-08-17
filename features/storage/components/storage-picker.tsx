"use client"

/**
 * /admin/storage — the two-level screen.
 *
 *   1. Every connected bucket as a card.
 *   2. Open one, and its full contents replace the grid.
 *
 * Which bucket a file lives in is not cosmetic: an object key is meaningless
 * without its bucket, so listing several accounts' files in one flat table would
 * produce rows nobody could act on. Pick a bucket first, then act inside it.
 */

import * as React from "react"

import { StorageManager } from "./storage-manager"
import { StorageAccountGrid, useStorageAccounts, type StorageAccount } from "./storage-accounts"

export function StoragePicker() {
  const { data, isPending, refetch } = useStorageAccounts()
  const [open, setOpen] = React.useState<StorageAccount | null>(null)

  const accounts = React.useMemo(() => data ?? [], [data])

  // Keep the opened card in step with a rename or a default change made while
  // it is open, rather than showing the label it had when it was clicked.
  React.useEffect(() => {
    if (!open) return
    const fresh = accounts.find((a) => a.id === open.id)
    if (!fresh) setOpen(null)
    else if (fresh.label !== open.label || fresh.bucket !== open.bucket) setOpen(fresh)
  }, [accounts, open])

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

  // No PageHeader here: StorageAccountGrid renders it, so the view toggle and
  // Add storage can live on the title line. Two headers would stack.
  return (
    <StorageAccountGrid
      accounts={accounts}
      isPending={isPending}
      onOpen={setOpen}
      onChanged={refetch}
    />
  )
}
