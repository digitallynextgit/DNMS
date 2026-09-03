"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, Copy, RadioTower, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-fetch"
import { formatDateTime } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface HookConfig {
  secretConfigured: boolean
  url: string | null
  baseUrl: string | null
  reachable: boolean
  isLoopback: boolean
  isPrivate: boolean
  isHttps: boolean
  devices: Array<{
    id: string
    name: string
    ipAddress: string
    macAddress: string | null
    lastSyncAt: string | null
    lastPushAt: string | null
  }>
}

/** A push seen within this window means the live path is currently working. */
const LIVE_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Set up and verify the realtime push path.
 *
 * The terminal is on a private LAN, so a hosted DNMS can never pull from it -
 * the Sync button only works from a machine on that network. The live path runs
 * the other way: the device POSTs each punch outbound to this URL, which every
 * office firewall already permits, and attendance lands the moment somebody
 * punches instead of whenever a cron next runs.
 *
 * This panel exists because none of that was discoverable. The endpoint was
 * built and enabled, but nothing told an admin what URL to paste into the
 * device, or whether anything had ever actually arrived.
 */
export function RealtimePushPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["attendance-hook-config"],
    queryFn: () =>
      apiFetch<{ data: HookConfig }>("/api/attendance/hook/config").then((r) => r.data),
    // The "last push" stamps go stale on their own; a slow refresh keeps the
    // indicator honest without polling hard for a config endpoint.
    refetchInterval: 60_000,
  })

  const [copied, setCopied] = React.useState(false)

  async function copyUrl() {
    if (!data?.url) return
    try {
      await navigator.clipboard.writeText(data.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy - select the URL and copy it manually.")
    }
  }

  if (isLoading) {
    return (
      <div className="border-border bg-card space-y-3 rounded-sm border p-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }
  if (!data) return null

  const lastPush = data.devices
    .map((d) => (d.lastPushAt ? new Date(d.lastPushAt).getTime() : 0))
    .reduce((a, b) => Math.max(a, b), 0)
  const isLive = lastPush > 0 && Date.now() - lastPush < LIVE_WINDOW_MS

  return (
    <div className="border-border bg-card space-y-4 rounded-sm border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RadioTower className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Realtime push</h2>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium",
            isLive
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isLive ? "animate-pulse bg-green-500" : "bg-muted-foreground/50",
            )}
          />
          {isLive ? "Receiving punches" : "No punches received yet"}
        </span>
      </div>

      <p className="text-muted-foreground text-sm">
        The terminal sits on the office LAN, so this server can only <em>pull</em> from it when it
        is on that same network - which is what the Sync button does. Realtime works the other way
        round: the device posts each punch <strong>out</strong> to the URL below, so attendance
        lands the moment somebody punches, from anywhere.
      </p>

      {/* ── Blockers ─────────────────────────────────────────────────────── */}
      {!data.secretConfigured && (
        <Warning>
          <code className="font-mono text-xs">ATTENDANCE_HOOK_SECRET</code> is not set on the
          server, so the hook rejects everything. Set it and restart before configuring the device.
        </Warning>
      )}
      {data.secretConfigured && data.isLoopback && (
        <Warning>
          The app URL is <code className="font-mono text-xs">{data.baseUrl}</code>. A device cannot
          post to <code className="font-mono text-xs">localhost</code> - that address means the
          terminal itself. Set <code className="font-mono text-xs">APP_URL</code> to the public
          address of this server so the device has somewhere to reach.
        </Warning>
      )}
      {data.secretConfigured && data.reachable && !data.isHttps && !data.isPrivate && (
        <Warning>
          This URL is <code className="font-mono text-xs">http://</code>. The secret below
          authorises writing attendance and would cross the public internet in clear text. Put the
          server behind HTTPS first.
        </Warning>
      )}

      {/* ── The URL ──────────────────────────────────────────────────────── */}
      {data.url && (
        <div className="space-y-2">
          <p className="text-xs font-medium">
            On the device:{" "}
            <span className="text-muted-foreground">
              Configuration → Network → Advanced → HTTP Listening
            </span>{" "}
            (or Event → HTTP Host Notification). Paste this as the destination URL:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="bg-muted min-w-0 flex-1 overflow-x-auto rounded-sm px-3 py-2 font-mono text-xs break-all">
              {data.url}
            </code>
            <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5" onClick={copyUrl}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            The secret is part of the path because some firmware refuses to store a
            <code className="mx-1 font-mono">?</code>in its URL field. Treat this URL as a
            credential - anyone holding it can write attendance.
          </p>
        </div>
      )}

      {/* ── Per-device state ─────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        {data.devices.map((d) => {
          const pushed = d.lastPushAt ? new Date(d.lastPushAt) : null
          return (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t pt-1.5 text-xs first:border-t-0 first:pt-0"
            >
              <span className="font-medium">{d.name}</span>
              <span className="text-muted-foreground">
                {pushed ? (
                  <>Last push {formatDateTime(pushed)}</>
                ) : (
                  <>
                    Never pushed
                    {!d.macAddress && " · no MAC on record yet, so pushes match the first device"}
                  </>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-sm bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="min-w-0">{children}</p>
    </div>
  )
}
