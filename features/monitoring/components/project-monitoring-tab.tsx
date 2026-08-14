"use client"

/**
 * Project → Monitoring tab.
 *
 * Two controls for the two halves of the 14 Aug outage:
 *   Uptime   - is this project's site serving right now (caps the damage)
 *   Renewals - what expires, when, and whose job it is (catches it early)
 *
 * Scoped to one project: the project comes from the URL, never a picker, so this
 * screen cannot register a monitor against somebody else's project.
 */

import * as React from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Plus, Trash2, Pencil, Activity, CalendarClock, Check, ShieldAlert } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { DateField } from "@/components/shared/date-field"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ASSET_KINDS,
  ASSET_KIND_LABELS,
  assetSchema,
  monitorSchema,
  type AssetInput,
  type AssetFormInput,
  type MonitorInput,
  type MonitorFormInput,
} from "../schemas/monitoring.schema"

// ─── Types ──────────────────────────────────────────────────────────────────

interface Person {
  id: string
  firstName: string
  lastName: string
}

interface Asset {
  id: string
  kind: (typeof ASSET_KINDS)[number]
  name: string
  provider: string | null
  url: string | null
  expiresAt: string
  autoRenew: boolean
  paymentMethod: string | null
  paymentExpiresAt: string | null
  notes: string | null
  owner: Person | null
}

interface OpenIncident {
  id: string
  startedAt: string
  detail: string | null
  acknowledgedAt: string | null
  escalationLevel: number
  acknowledgedBy: { firstName: string; lastName: string } | null
}

interface Monitor {
  id: string
  url: string
  label: string | null
  isActive: boolean
  state: "UNKNOWN" | "UP" | "DOWN"
  lastCheckedAt: string | null
  lastStatusCode: number | null
  lastError: string | null
  owner: Person | null
  incidents: OpenIncident[]
}

interface Overview {
  assets: Asset[]
  monitors: Monitor[]
  recentIncidents: {
    id: string
    startedAt: string
    endedAt: string | null
    detail: string | null
    monitor: { url: string; label: string | null }
  }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysUntil(iso: string): number {
  const a = new Date()
  a.setHours(0, 0, 0, 0)
  const b = new Date(iso)
  b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function expiryTone(days: number): string {
  if (days < 0) return "text-destructive font-semibold"
  if (days <= 7) return "text-destructive"
  if (days <= 30) return "text-amber-600 dark:text-amber-500"
  return "text-muted-foreground"
}

function expiryLabel(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`
  if (days === 0) return "Expires today"
  return `in ${days}d`
}

function since(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
}

// ─── Root ───────────────────────────────────────────────────────────────────

export function ProjectMonitoringTab({
  projectRef,
  canManage,
}: {
  projectRef: string
  canManage: boolean
}) {
  const base = `/api/projects/${projectRef}/monitoring`

  const { data, isPending, refetch } = useQuery({
    queryKey: ["project-monitoring", projectRef],
    // Double `data`: the service returns { data: Overview } and respond() wraps
    // that again, so the payload sits at res.data.data.
    queryFn: async () => (await apiFetch<{ data: { data: Overview } }>(base)).data.data,
    enabled: canManage,
    // The sweep runs every 5 minutes server-side; refetching each minute keeps an
    // open incident from looking stale on a left-open tab.
    refetchInterval: 60_000,
  })

  if (!canManage) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Not available"
        description="Only the Account Manager or a project admin can manage monitoring."
        variant="card"
      />
    )
  }

  const monitors = data?.monitors ?? []
  const assets = data?.assets ?? []
  const down = monitors.filter((m) => m.state === "DOWN")
  const expiringSoon = assets.filter((a) => daysUntil(a.expiresAt) <= 30)
  const unowned = assets.filter((a) => !a.owner)

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Down right now"
          value={down.length}
          tone={down.length ? "text-destructive" : ""}
          icon={Activity}
        />
        <StatCard
          label="Expiring in 30 days"
          value={expiringSoon.length}
          tone={expiringSoon.length ? "text-amber-600 dark:text-amber-500" : ""}
          icon={CalendarClock}
        />
        <StatCard
          label="Without an owner"
          value={unowned.length}
          tone={unowned.length ? "text-destructive" : ""}
          icon={ShieldAlert}
        />
      </div>

      <UptimeSection
        base={base}
        monitors={monitors}
        isPending={isPending}
        onDone={() => void refetch()}
      />
      <RenewalsSection
        base={base}
        assets={assets}
        isPending={isPending}
        onDone={() => void refetch()}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string
  value: number
  tone: string
  icon: React.ElementType
}) {
  return (
    <div className="bg-card rounded-md border p-4">
      <div className="flex items-start justify-between">
        <p className="text-muted-foreground text-xs">{label}</p>
        <Icon className="text-muted-foreground h-4 w-4" />
      </div>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  )
}

// ─── Uptime ─────────────────────────────────────────────────────────────────

function UptimeSection({
  base,
  monitors,
  isPending,
  onDone,
}: {
  base: string
  monitors: Monitor[]
  isPending: boolean
  onDone: () => void
}) {
  const [editing, setEditing] = React.useState<Monitor | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [removing, setRemoving] = React.useState<Monitor | null>(null)

  const ack = useMutation({
    mutationFn: (incidentId: string) =>
      apiFetch(`${base}/incidents/${incidentId}/ack`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Acknowledged - escalation stopped")
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (m: Monitor) => apiFetch(`${base}/monitors/${m.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Monitor removed")
      setRemoving(null)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Uptime</h2>
          <p className="text-muted-foreground text-xs">
            Checked every 5 minutes. Alerts escalate every 30 minutes until acknowledged.
          </p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" />
          Watch a URL
        </Button>
      </div>

      {isPending && <Skeleton className="h-20 rounded-md" />}

      {!isPending && monitors.length === 0 && (
        <EmptyState
          icon={Activity}
          title="Nothing is being watched"
          description="Add this project's site and DNMS will check it every 5 minutes."
          variant="card"
        />
      )}

      <div className="space-y-2">
        {monitors.map((m) => {
          const incident = m.incidents[0]
          return (
            <div key={m.id} className="bg-card rounded-md border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StateDot state={m.state} />
                    <p className="text-sm font-medium">{m.label || m.url}</p>
                    {!m.isActive && (
                      <Badge variant="secondary" className="text-[10px]">
                        Paused
                      </Badge>
                    )}
                  </div>
                  {m.label && <p className="text-muted-foreground truncate text-xs">{m.url}</p>}
                  <p className="text-muted-foreground text-[11px]">
                    {m.lastCheckedAt ? `Checked ${since(m.lastCheckedAt)} ago` : "Not checked yet"}
                    {m.lastStatusCode ? ` · HTTP ${m.lastStatusCode}` : ""}
                    {m.lastError ? ` · ${m.lastError}` : ""}
                    {m.owner ? ` · ${m.owner.firstName} ${m.owner.lastName}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setEditing(m)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive h-8 px-2"
                    onClick={() => setRemoving(m)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {incident && (
                <div className="border-destructive/40 bg-destructive/5 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="text-destructive text-xs font-medium">
                      Down for {since(incident.startedAt)}
                      {incident.escalationLevel > 0 &&
                        ` · escalated to level ${incident.escalationLevel}`}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {incident.detail ?? "Unreachable"}
                      {incident.acknowledgedAt && incident.acknowledgedBy
                        ? ` · acknowledged by ${incident.acknowledgedBy.firstName} ${incident.acknowledgedBy.lastName}`
                        : ""}
                    </p>
                  </div>
                  {!incident.acknowledgedAt && (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      loading={ack.isPending}
                      disabled={ack.isPending}
                      onClick={() => ack.mutate(incident.id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      I&apos;m on it
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <MonitorDialog
        base={base}
        monitor={editing}
        open={adding || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false)
            setEditing(null)
          }
        }}
        onDone={onDone}
      />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Stop watching this URL?"
        description={
          removing
            ? `${removing.url} will no longer be checked, and its outage history is deleted.`
            : ""
        }
        confirmLabel="Remove"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </section>
  )
}

function StateDot({ state }: { state: Monitor["state"] }) {
  const map = {
    UP: { cls: "bg-emerald-500", label: "Up" },
    DOWN: { cls: "bg-destructive", label: "Down" },
    UNKNOWN: { cls: "bg-muted-foreground/40", label: "Not checked" },
  } as const
  const s = map[state]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", s.cls)} />
      <span className="text-muted-foreground text-[11px]">{s.label}</span>
    </span>
  )
}

// ─── Renewals ───────────────────────────────────────────────────────────────

function RenewalsSection({
  base,
  assets,
  isPending,
  onDone,
}: {
  base: string
  assets: Asset[]
  isPending: boolean
  onDone: () => void
}) {
  const [editing, setEditing] = React.useState<Asset | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [removing, setRemoving] = React.useState<Asset | null>(null)

  const remove = useMutation({
    mutationFn: (a: Asset) => apiFetch(`${base}/assets/${a.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Removed from the register")
      setRemoving(null)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Renewals</h2>
          <p className="text-muted-foreground text-xs">
            Reminders at 60, 30, 14, 7, 3 and 1 days, then daily once overdue. Auto-renew does not
            skip them.
          </p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add renewal
        </Button>
      </div>

      {isPending && <Skeleton className="h-20 rounded-md" />}

      {!isPending && assets.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          title="Nothing in the register"
          description="Add this project's domain, SSL certificate, hosting plan and licences."
          variant="card"
        />
      )}

      {assets.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-medium">Asset</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium">Expires</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium">Auto</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium">Owner</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const days = daysUntil(a.expiresAt)
                return (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{a.name}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {ASSET_KIND_LABELS[a.kind]}
                        {a.provider ? ` · ${a.provider}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("text-xs", expiryTone(days))}>{expiryLabel(days)}</span>
                      <p className="text-muted-foreground text-[11px]">
                        {new Date(a.expiresAt).toDateString()}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant={a.autoRenew ? "secondary" : "outline"}
                        className="text-[10px]"
                      >
                        {a.autoRenew ? "On" : "Off"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {a.owner ? (
                        `${a.owner.firstName} ${a.owner.lastName}`
                      ) : (
                        <span className="text-destructive">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${a.name}`}
                          onClick={() => setEditing(a)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${a.name}`}
                          onClick={() => setRemoving(a)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      <AssetDialog
        base={base}
        asset={editing}
        open={adding || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false)
            setEditing(null)
          }
        }}
        onDone={onDone}
      />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove from the register?"
        description={
          removing ? `${removing.name} will stop producing renewal reminders entirely.` : ""
        }
        confirmLabel="Remove"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </section>
  )
}

// ─── People picker ──────────────────────────────────────────────────────────

function usePeople(enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["monitoring-people"],
    queryFn: () => apiFetch<{ data: Person[] }>("/api/employees?status=ACTIVE&limit=200"),
    enabled,
  })
  return data?.data ?? []
}

/** Sentinel for "nobody" - Radix Select cannot hold an empty-string value. */
const UNASSIGNED = "__unassigned__"

// ─── Monitor dialog ─────────────────────────────────────────────────────────

function MonitorDialog({
  base,
  monitor,
  open,
  onOpenChange,
  onDone,
}: {
  base: string
  monitor: Monitor | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const isEdit = !!monitor
  const people = usePeople(open)

  const form = useForm<MonitorFormInput, unknown, MonitorInput>({
    resolver: zodResolver(monitorSchema),
    defaultValues: { url: "", label: "", ownerId: "", isActive: true },
  })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      url: monitor?.url ?? "",
      label: monitor?.label ?? "",
      ownerId: monitor?.owner?.id ?? "",
      isActive: monitor?.isActive ?? true,
    })
  }, [open, monitor, form])

  const save = useMutation({
    mutationFn: (values: MonitorInput) => {
      const init = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }
      return isEdit
        ? apiFetch(`${base}/monitors/${monitor!.id}`, { method: "PATCH", ...init })
        : apiFetch(`${base}/monitors`, { method: "POST", ...init })
    },
    onSuccess: () => {
      toast.success(isEdit ? "Monitor updated" : "Now watching that URL")
      onOpenChange(false)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md lg:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{isEdit ? "Edit monitor" : "Watch a URL"}</DialogTitle>
          <DialogDescription className="text-xs">
            Checked every 5 minutes. Two consecutive failures counts as an outage.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          {/* id + form= on the footer button, so the submit lives with the fields
              but the button can sit in the pinned DialogFooter. */}
          <form
            id="monitor-form"
            onSubmit={form.handleSubmit((v) => save.mutate(v))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" className="h-9 text-sm" {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    Include https://. Any 2xx or 3xx counts as up.
                  </FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Label</FormLabel>
                  <FormControl>
                    <Input placeholder="Storefront" className="h-9 text-sm" {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">Shown in alerts.</FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ownerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Owner</FormLabel>
                  <Select
                    value={field.value || UNASSIGNED}
                    onValueChange={(v) => field.onChange(v === UNASSIGNED ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED} className="text-sm">
                        Project team
                      </SelectItem>
                      {people.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-sm">
                          {p.firstName} {p.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-[11px]">
                    Alerts go to the whole project team either way.
                  </FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2.5 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="cursor-pointer text-xs font-medium">Active</FormLabel>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-9 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="monitor-form"
            className="h-9 text-xs"
            disabled={save.isPending}
            loading={save.isPending}
          >
            {isEdit ? "Save" : "Start watching"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Asset dialog ───────────────────────────────────────────────────────────

function AssetDialog({
  base,
  asset,
  open,
  onOpenChange,
  onDone,
}: {
  base: string
  asset: Asset | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const isEdit = !!asset
  const people = usePeople(open)

  const form = useForm<AssetFormInput, unknown, AssetInput>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      kind: "DOMAIN",
      name: "",
      provider: "",
      url: "",
      expiresAt: "",
      autoRenew: true,
      paymentMethod: "",
      paymentExpiresAt: "",
      ownerId: "",
      notes: "",
    },
  })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      kind: asset?.kind ?? "DOMAIN",
      name: asset?.name ?? "",
      provider: asset?.provider ?? "",
      url: asset?.url ?? "",
      expiresAt: asset?.expiresAt ? asset.expiresAt.slice(0, 10) : "",
      autoRenew: asset?.autoRenew ?? true,
      paymentMethod: asset?.paymentMethod ?? "",
      paymentExpiresAt: asset?.paymentExpiresAt ? asset.paymentExpiresAt.slice(0, 10) : "",
      ownerId: asset?.owner?.id ?? "",
      notes: asset?.notes ?? "",
    })
  }, [open, asset, form])

  const save = useMutation({
    mutationFn: (values: AssetInput) => {
      const init = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }
      return isEdit
        ? apiFetch(`${base}/assets/${asset!.id}`, { method: "PATCH", ...init })
        : apiFetch(`${base}/assets`, { method: "POST", ...init })
    },
    onSuccess: () => {
      toast.success(isEdit ? "Renewal updated" : "Added to the register")
      onOpenChange(false)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg lg:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {isEdit ? `Edit ${asset!.name}` : "Add a renewal"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Anything that takes this project&apos;s site down if it lapses.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="asset-form"
            onSubmit={form.handleSubmit((v) => save.mutate(v))}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ASSET_KINDS.map((k) => (
                          <SelectItem key={k} value={k} className="text-sm">
                            {ASSET_KIND_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Name</FormLabel>
                    <FormControl>
                      <Input placeholder="digitallynext.com" className="h-9 text-sm" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Provider</FormLabel>
                    <FormControl>
                      <Input placeholder="GoDaddy" className="h-9 text-sm" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Expires on</FormLabel>
                    <FormControl>
                      {/* The shared shadcn calendar-in-a-popover, not a native
                          date input - `modal` layers it above the Dialog. */}
                      <DateField
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pick a date"
                        modal
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Owner</FormLabel>
                    <Select
                      value={field.value || UNASSIGNED}
                      onValueChange={(v) => field.onChange(v === UNASSIGNED ? "" : v)}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED} className="text-sm">
                          Unassigned
                        </SelectItem>
                        {people.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-sm">
                            {p.firstName} {p.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-[11px]">
                      The named person accountable.
                    </FormDescription>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Paid by</FormLabel>
                    <FormControl>
                      <Input placeholder="HDFC ••4321" className="h-9 text-sm" {...field} />
                    </FormControl>
                    <FormDescription className="text-[11px]">Which card / account.</FormDescription>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="paymentExpiresAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Card expires</FormLabel>
                  <FormControl>
                    <DateField value={field.value} onChange={field.onChange} modal />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    A dead card is the usual root cause of a failed renewal.
                  </FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="autoRenew"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-2.5 space-y-0 rounded-md border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-0.5"
                    />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="cursor-pointer text-xs font-medium">
                      Auto-renew is enabled
                    </FormLabel>
                    <FormDescription className="text-[11px]">
                      Reminders are sent either way. Auto-renew was on for the domain that lapsed on
                      14 Aug - it is not a control.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-9 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="asset-form"
            className="h-9 text-xs"
            disabled={save.isPending}
            loading={save.isPending}
          >
            {isEdit ? "Save" : "Add to register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
