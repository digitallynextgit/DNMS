"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, LogIn, RefreshCw, Unplug, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useDisconnectDrive, useDriveStatus } from "../hooks/use-google-drive"

// A full-page navigation, not fetch: Google's consent screen has to load in the tab.
const CONNECT_URL = "/api/integrations/google-drive/connect"

/** Admin -> Integrations: which Google account holds the Repository, and Connect / Disconnect. */
export function DriveConnectCard() {
  const { data, isPending } = useDriveStatus()
  const disconnect = useDisconnectDrive()
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Google sends the admin back with ?drive=connected or ?drive=error&reason=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const outcome = params.get("drive")
    if (!outcome) return
    // A fixed id, so the dev double-run of effects shows one toast.
    if (outcome === "connected") toast.success("Google account connected", { id: "drive-connect" })
    else {
      toast.error(params.get("reason") || "Could not connect the Google account", {
        id: "drive-connect",
      })
    }
    params.delete("drive")
    params.delete("reason")
    const qs = params.toString()
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`,
    )
  }, [])

  const account = data?.account ?? null
  const healthy = !!account && !data?.error

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className="truncate text-base">Google Drive account</CardTitle>
          {!isPending &&
            (healthy ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Connected" />
            ) : (
              <XCircle className="text-destructive h-4 w-4 shrink-0" aria-label="Not connected" />
            ))}
        </div>
        {account && (
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <a href={CONNECT_URL}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reconnect
              </a>
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Unplug className="mr-1.5 h-3.5 w-3.5" /> Disconnect
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {isPending ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        ) : account ? (
          <>
            <div className="flex min-w-0 items-center gap-3">
              {account.photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- Google's avatar host isn't in next/image's list
                <img
                  src={account.photo}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 shrink-0 rounded-full"
                />
              ) : (
                <span className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                  {account.email[0]?.toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{account.name ?? account.email}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {account.email} · connected {format(new Date(account.connectedAt), "d MMM yyyy")}
                  {account.connectedBy ? ` by ${account.connectedBy}` : ""}
                </p>
              </div>
            </div>
            {data?.error && (
              <p className="text-destructive flex items-start gap-1.5 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {data.error}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Repository files are stored in this account&apos;s Drive. Storage, plan, backups and
              the move from Backblaze are on the Storage page.
            </p>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Connect the company&apos;s Google account to store Repository files in its Drive. Sign
              in as that account (not your own) and tick the Drive box on Google&apos;s screen. DNMS
              can only see the files it creates there.
            </p>
            {data?.credentials ? (
              <Button asChild>
                <a href={CONNECT_URL}>
                  <LogIn className="mr-1.5 h-3.5 w-3.5" /> Connect Google account
                </a>
              </Button>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Fill in the OAuth client ID and secret in the Google Drive section below first.
              </p>
            )}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disconnect the Google account?"
        description={`Files already in ${account?.email ?? "this"} Drive stop opening in DNMS, and new uploads go back to Backblaze, until the same account is connected again. Nothing in Drive is deleted.`}
        confirmLabel="Disconnect"
        variant="destructive"
        isLoading={disconnect.isPending}
        onConfirm={() => disconnect.mutate(undefined, { onSuccess: () => setConfirmOpen(false) })}
      />
    </Card>
  )
}
