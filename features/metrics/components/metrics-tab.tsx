"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Info, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"
import {
  CHANNELS,
  changePercent,
  formatMetricValue,
  GOOD_WHEN,
  healthOf,
  movedWell,
  shiftWeek,
  UNITS,
  weekLabel,
  weekStartOf,
} from "../lib/metrics"
import {
  useCreateMetric,
  useMetricsBoard,
  useRemoveMetric,
  useSaveEntries,
} from "../hooks/use-metrics"
import type { MetricRow } from "../types"

const HEALTH_DOT: Record<string, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
  unknown: "bg-muted-foreground/30",
}

/** The band in words, for the column and the tooltip. */
function bandText(m: MetricRow): string {
  if (m.healthyNote) return m.healthyNote
  if (m.healthyMin != null && m.healthyMax != null) return `${m.healthyMin}-${m.healthyMax}`
  if (m.healthyMin != null) return `${m.healthyMin} or more`
  if (m.healthyMax != null) return `${m.healthyMax} or less`
  return "-"
}

export function MetricsTab({ projectId }: { projectId: string }) {
  const [week, setWeek] = React.useState<string | null>(null)
  const { data, isLoading } = useMetricsBoard(projectId, week)
  const saveEntries = useSaveEntries(projectId)
  const removeMetric = useRemoveMetric(projectId)

  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState<Record<string, string>>({})
  const [adding, setAdding] = React.useState(false)

  const current = data?.weekStart ?? weekStartOf(new Date())
  const canManage = data?.canManage ?? false
  const metrics = React.useMemo(() => data?.metrics ?? [], [data])

  // Leaving edit mode throws the draft away, so a stale box never saves over a newer value.
  const startEditing = () => {
    setDraft(
      Object.fromEntries(metrics.map((m) => [m.id, m.current == null ? "" : String(m.current)])),
    )
    setEditing(true)
  }

  const save = () => {
    const values = metrics.map((m) => {
      const raw = (draft[m.id] ?? "").trim()
      const n = raw === "" ? null : Number(raw)
      return { metricId: m.id, value: n != null && Number.isFinite(n) ? n : null, note: null }
    })
    saveEntries.mutate({ weekStart: current, values }, { onSuccess: () => setEditing(false) })
  }

  const byChannel = React.useMemo(() => {
    const map = new Map<string, MetricRow[]>()
    for (const m of metrics) {
      const list = map.get(m.channel) ?? []
      list.push(m)
      map.set(m.channel, list)
    }
    // The standard channel order first, then anything a project invented.
    const known = CHANNELS.filter((c) => map.has(c))
    const extra = [...map.keys()].filter((c) => !CHANNELS.includes(c as never)).sort()
    return [...known, ...extra].map((c) => [c, map.get(c)!] as const)
  }, [metrics])

  if (isLoading) return <ListSkeleton rows={6} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Previous week"
            onClick={() => setWeek(shiftWeek(current, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[11rem] px-2 text-center text-sm font-medium tabular-nums">
            {weekLabel(current)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Next week"
            disabled={current >= weekStartOf(new Date())}
            onClick={() => setWeek(shiftWeek(current, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {current !== weekStartOf(new Date()) ? (
            <Button variant="ghost" className="ml-1 h-8" onClick={() => setWeek(null)}>
              This week
            </Button>
          ) : null}
        </div>

        {canManage ? (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button variant="ghost" className="h-8" onClick={() => setEditing(false)}>
                  <X className="mr-1 h-3.5 w-3.5" /> Cancel
                </Button>
                <Button className="h-8" onClick={save} disabled={saveEntries.isPending}>
                  Save week
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="h-8" onClick={() => setAdding(true)}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add metric
                </Button>
                <Button className="h-8" onClick={startEditing}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Fill this week
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {metrics.length === 0 ? (
        <EmptyState
          title="No metrics yet"
          description="Add the numbers this project is judged on, and they'll be tracked week by week."
        />
      ) : (
        byChannel.map(([channel, rows]) => (
          <Card key={channel}>
            <CardContent className="p-0">
              <div className="border-b px-4 py-2.5">
                <h3 className="text-sm font-semibold">{channel}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-xs">
                      <th className="px-4 py-2 font-medium">Metric</th>
                      <th className="w-32 px-3 py-2 text-right font-medium">Previous</th>
                      <th className="w-36 px-3 py-2 text-right font-medium">This week</th>
                      <th className="w-24 px-3 py-2 text-right font-medium">Change</th>
                      <th className="w-40 px-3 py-2 font-medium">Healthy</th>
                      {canManage && !editing ? <th className="w-10 px-2 py-2" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((m) => {
                      const pct = changePercent(m.current, m.previous)
                      const well = movedWell(m.current, m.previous, m.goodWhen)
                      const health = healthOf(m.current, m)
                      return (
                        <tr key={m.id} className="border-t">
                          <td className="px-4 py-2.5">
                            <span className="flex items-center gap-1.5">
                              <span
                                className={cn("size-1.5 shrink-0 rounded-full", HEALTH_DOT[health])}
                                aria-hidden
                              />
                              {m.name}
                              {m.howTo ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="text-muted-foreground/70 h-3.5 w-3.5 shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">{m.howTo}</TooltipContent>
                                </Tooltip>
                              ) : null}
                            </span>
                          </td>
                          <td className="text-muted-foreground px-3 py-2.5 text-right tabular-nums">
                            {formatMetricValue(m.previous, m.unit)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {editing ? (
                              <Input
                                inputMode="decimal"
                                className="h-8 text-right"
                                aria-label={m.name}
                                value={draft[m.id] ?? ""}
                                onChange={(e) =>
                                  setDraft((d) => ({ ...d, [m.id]: e.target.value }))
                                }
                              />
                            ) : (
                              <span className="font-medium">
                                {formatMetricValue(m.current, m.unit)}
                              </span>
                            )}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2.5 text-right tabular-nums",
                              well === true && "text-emerald-600 dark:text-emerald-400",
                              well === false && "text-rose-600 dark:text-rose-400",
                              well === null && "text-muted-foreground",
                            )}
                          >
                            {pct == null ? "-" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
                          </td>
                          <td className="text-muted-foreground px-3 py-2.5 text-xs">
                            {bandText(m)}
                          </td>
                          {canManage && !editing ? (
                            <td className="px-2 py-2.5 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground h-7 w-7"
                                aria-label={`Remove ${m.name}`}
                                onClick={() => removeMetric.mutate(m.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          ) : null}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <AddMetricDialog projectId={projectId} open={adding} onOpenChange={setAdding} />
    </div>
  )
}

function AddMetricDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const createMetric = useCreateMetric(projectId)
  const [channel, setChannel] = React.useState<string>(CHANNELS[0])
  const [name, setName] = React.useState("")
  const [unit, setUnit] = React.useState<string>("NUMBER")
  const [goodWhen, setGoodWhen] = React.useState<string>("UP")
  const [howTo, setHowTo] = React.useState("")
  const [healthyMin, setHealthyMin] = React.useState("")
  const [healthyMax, setHealthyMax] = React.useState("")

  const submit = () => {
    const num = (v: string) => (v.trim() === "" ? null : Number(v))
    createMetric.mutate(
      {
        channel: channel as never,
        name,
        unit: unit as never,
        goodWhen: goodWhen as never,
        howTo: howTo.trim() || null,
        healthyMin: num(healthyMin),
        healthyMax: num(healthyMax),
        healthyNote: null,
      },
      {
        onSuccess: () => {
          setName("")
          setHowTo("")
          setHealthyMin("")
          setHealthyMax("")
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a metric</DialogTitle>
          <DialogDescription>
            It joins this project&apos;s scorecard only. Other projects keep their own list.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="metric-name">Name</Label>
            <Input
              id="metric-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Non-brand clicks"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="metric-min">Healthy from</Label>
              <Input
                id="metric-min"
                inputMode="decimal"
                value={healthyMin}
                onChange={(e) => setHealthyMin(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="metric-max">to</Label>
              <Input
                id="metric-max"
                inputMode="decimal"
                value={healthyMax}
                onChange={(e) => setHealthyMax(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Good when</Label>
              <Select value={goodWhen} onValueChange={setGoodWhen}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOOD_WHEN.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g === "UP" ? "Going up" : "Going down"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="metric-howto">How to calculate</Label>
            <Input
              id="metric-howto"
              value={howTo}
              onChange={(e) => setHowTo(e.target.value)}
              placeholder="Orders / sessions"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || createMetric.isPending}>
            Add metric
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
