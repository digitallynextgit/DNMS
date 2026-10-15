"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { LogOut, Monitor, Smartphone, Tablet } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { cn, formatDate } from "@/lib/utils"

interface Device {
  id: string
  kind: "web" | "mobile"
  label: string
  form: "desktop" | "phone" | "tablet"
  ip: string | null
  signedInAt: string
  lastSeenAt: string | null
  current: boolean
}

const KEY = ["my-devices"]

/** "just now", "5 min ago", "3 hours ago", else the date. */
function ago(iso: string | null): string {
  if (!iso) return "-"
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60_000)
  if (min < 2) return "just now"
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`
  return formatDate(iso)
}

const ICON = { desktop: Monitor, phone: Smartphone, tablet: Tablet }

export function SignedInDevices() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiFetch<{ data: Device[] }>("/api/profile/sessions")).data,
    refetchInterval: 60_000,
  })
  const [confirm, setConfirm] = useState<Device | "others" | null>(null)

  const logoutOne = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/profile/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Signed out on that device")
      setConfirm(null)
      void qc.invalidateQueries({ queryKey: KEY })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't sign that device out"),
  })
  const logoutOthers = useMutation({
    mutationFn: () =>
      apiFetch<{ data: { revoked: number } }>("/api/profile/sessions", { method: "DELETE" }),
    onSuccess: (res) => {
      toast.success(
        res.data.revoked === 0
          ? "No other devices were signed in"
          : `Signed out on ${res.data.revoked} other device${res.data.revoked === 1 ? "" : "s"}`,
      )
      setConfirm(null)
      void qc.invalidateQueries({ queryKey: KEY })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't sign out"),
  })

  const devices = data ?? []
  const others = devices.filter((d) => !d.current)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-4 w-4" />
            Signed-in devices
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Every browser and phone where your account is signed in. Sign out anything you
            don&apos;t recognise.
          </p>
        </div>
        {others.length > 0 && (
          <Button variant="outline" onClick={() => setConfirm("others")}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out all other devices
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : devices.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing to show yet. Devices appear here from their next sign-in.
          </p>
        ) : (
          <ul className="divide-y rounded-sm border">
            {devices.map((d) => {
              const Icon = ICON[d.form]
              return (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="text-muted-foreground h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {d.label}
                      {d.current && <Badge variant="secondary">This device</Badge>}
                      {d.kind === "mobile" && <Badge variant="outline">Phone app</Badge>}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {d.ip ? `${d.ip} · ` : ""}Signed in {formatDate(d.signedInAt)} · Last active{" "}
                      {ago(d.lastSeenAt)}
                    </p>
                  </div>
                  {!d.current && (
                    <Button
                      variant="ghost"
                      className={cn("text-muted-foreground hover:text-destructive")}
                      onClick={() => setConfirm(d)}
                    >
                      <LogOut className="mr-1.5 h-4 w-4" />
                      Log out
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirm !== null && confirm !== "others"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Sign out on this device?"
        description={
          confirm && confirm !== "others"
            ? `${confirm.label} will be signed out within a minute. If it isn't yours, also change your password.`
            : ""
        }
        confirmLabel="Log out"
        variant="destructive"
        isLoading={logoutOne.isPending}
        onConfirm={() => confirm && confirm !== "others" && logoutOne.mutate(confirm.id)}
      />
      <ConfirmDialog
        open={confirm === "others"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Log out of all other devices?"
        description="Every other browser and the phone app will be signed out within a minute. This browser stays signed in."
        confirmLabel="Log out others"
        variant="destructive"
        isLoading={logoutOthers.isPending}
        onConfirm={() => logoutOthers.mutate()}
      />
    </Card>
  )
}
