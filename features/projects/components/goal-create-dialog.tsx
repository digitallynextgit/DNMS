"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { DateField } from "@/components/shared/date-field"
import {
  currentPlanMonth,
  formatMonth,
  monthISO,
  parseMonth,
  shiftMonth,
} from "../lib/calendar-months"
import type { GoalActualSource } from "../lib/goal-derivation"
import { GoalTagInput } from "./goal-tag-input"
import { fmtNumber } from "./goal-number"

/** A service the goal can be split across, with whoever owns it now. */
export interface SplitService {
  code: string
  name: string
  ownerName: string | null
}

interface PartDraft {
  on: boolean
  value: string
  source: GoalActualSource
}

/** A goal with an optional number, one-time or every month, split across the project's services. */
export function GoalCreateDialog({
  projectId,
  open,
  onOpenChange,
  services,
  allTags,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  services: SplitService[]
  allTags: string[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {/* Mounted only while open, so each opening starts blank. */}
        {open && (
          <GoalForm
            projectId={projectId}
            services={services}
            allTags={allTags}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function GoalForm({
  projectId,
  services,
  allTags,
  onDone,
}: {
  projectId: string
  services: SplitService[]
  allTags: string[]
  onDone: () => void
}) {
  const qc = useQueryClient()
  const [title, setTitle] = React.useState("")
  const [counted, setCounted] = React.useState(false)
  const [metricLabel, setMetricLabel] = React.useState("")
  const [target, setTarget] = React.useState("")
  const [recurring, setRecurring] = React.useState(false)
  const thisMonth = currentPlanMonth()
  const [startMonth, setStartMonth] = React.useState(thisMonth)
  const [targetDate, setTargetDate] = React.useState("")
  const [tags, setTags] = React.useState<string[]>([])
  const [parts, setParts] = React.useState<Record<string, PartDraft>>({})

  const ym = parseMonth(`${thisMonth}-01`)!
  const monthChoices = [0, 1, 2].map((by) => {
    const m = shiftMonth(ym, by)
    return monthISO(m.year, m.month0).slice(0, 7)
  })

  const targetValue = Number(target)
  const hasNumber = counted && metricLabel.trim() !== "" && targetValue > 0
  const chosen = services.filter((s) => parts[s.code]?.on)
  const splitTotal = chosen.reduce((sum, s) => sum + (Number(parts[s.code]?.value) || 0), 0)
  const splitIncomplete = chosen.some((s) => !(Number(parts[s.code]?.value) > 0))
  const valid = title.trim() !== "" && (!counted || hasNumber) && !splitIncomplete

  const setPart = (code: string, patch: Partial<PartDraft>) =>
    setParts((cur) => {
      const prev: PartDraft = cur[code] ?? { on: false, value: "", source: "MANUAL" }
      return { ...cur, [code]: { ...prev, ...patch } }
    })

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/projects/${projectId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-goals", projectId] })
      qc.invalidateQueries({ queryKey: ["goals-portfolio"] })
      toast.success(recurring ? "Goal added - it repeats every month" : "Goal added")
      onDone()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't add the goal"),
  })

  const submit = () => {
    if (!valid || create.isPending) return
    create.mutate({
      title: title.trim(),
      tags,
      recurring,
      startMonth: recurring ? startMonth : null,
      targetDate: recurring ? null : targetDate || null,
      metricLabel: hasNumber ? metricLabel.trim() : null,
      targetValue: hasNumber ? targetValue : null,
      split: hasNumber
        ? chosen.map((s) => ({
            service: s.code,
            targetValue: Number(parts[s.code]!.value),
            actualSource: parts[s.code]!.source,
          }))
        : [],
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a goal</DialogTitle>
        <DialogDescription>
          What this project is for. Give it a number to track results, and split it by service so
          each service&rsquo;s owner is accountable for their share.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label required className="text-muted-foreground text-[11px]">
            Goal
          </Label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Monthly orders, or Launch the new storefront"
            aria-label="Goal title"
            maxLength={200}
          />
        </div>

        <label className="flex items-center justify-between gap-3 rounded-sm border px-3 py-2.5">
          <span>
            <span className="text-sm font-medium">Measure with a number</span>
            <span className="text-muted-foreground block text-xs">
              e.g. 3000 orders - results are entered against it
            </span>
          </span>
          <Switch
            checked={counted}
            onCheckedChange={setCounted}
            aria-label="Measure with a number"
          />
        </label>

        {counted && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label required className="text-muted-foreground text-[11px]">
                What is counted
              </Label>
              <Input
                value={metricLabel}
                onChange={(e) => setMetricLabel(e.target.value)}
                placeholder="Orders"
                maxLength={40}
                aria-label="What is counted"
              />
            </div>
            <div className="space-y-1.5">
              <Label required className="text-muted-foreground text-[11px]">
                Target
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="3000"
                aria-label="Target"
              />
            </div>
          </div>
        )}

        <label className="flex items-center justify-between gap-3 rounded-sm border px-3 py-2.5">
          <span>
            <span className="text-sm font-medium">Repeats every month</span>
            <span className="text-muted-foreground block text-xs">
              Each month gets its own copy, judged on its own. You can change the number or stop it
              later.
            </span>
          </span>
          <Switch
            checked={recurring}
            onCheckedChange={setRecurring}
            aria-label="Repeats every month"
          />
        </label>

        {recurring ? (
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[11px]">Starting</Label>
            <Select value={startMonth} onValueChange={setStartMonth}>
              <SelectTrigger className="h-9 text-sm" aria-label="Starting month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthChoices.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMonth(`${m}-01`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[11px]">Target date</Label>
            {/* modal: the calendar pops over a dialog and has to layer above it. */}
            <DateField
              value={targetDate}
              onChange={setTargetDate}
              placeholder="Target date"
              modal
            />
          </div>
        )}

        {hasNumber && services.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label className="text-muted-foreground text-[11px]">Split by service</Label>
              {chosen.length > 0 && (
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    splitTotal === targetValue
                      ? "text-muted-foreground"
                      : "text-amber-600 dark:text-amber-400",
                  )}
                >
                  adds up to {fmtNumber(splitTotal)} of {fmtNumber(targetValue)}
                </span>
              )}
            </div>
            <ul className="divide-y rounded-sm border">
              {services.map((s) => {
                const part = parts[s.code]
                return (
                  <li key={s.code} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <Checkbox
                      checked={part?.on ?? false}
                      onCheckedChange={(c) => setPart(s.code, { on: c === true })}
                      aria-label={`Include ${s.name}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-sm">{s.name}</span>
                      <span className="text-muted-foreground block text-[11px]">
                        {s.ownerName ? `owner ${s.ownerName}` : "no owner - the account manager"}
                      </span>
                    </span>
                    {part?.on && (
                      <>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={part.value}
                          onChange={(e) => setPart(s.code, { value: e.target.value })}
                          placeholder="Share"
                          className="h-8 w-24 text-sm"
                          aria-label={`${s.name} share`}
                        />
                        <Select
                          value={part.source}
                          onValueChange={(v) => setPart(s.code, { source: v as GoalActualSource })}
                        >
                          <SelectTrigger
                            className="h-8 w-32 text-xs"
                            aria-label={`${s.name} results from`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MANUAL" className="text-xs">
                              Owner enters
                            </SelectItem>
                            <SelectItem value="META_PURCHASES" className="text-xs">
                              Meta purchases
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="text-muted-foreground text-[11px]">
              Each part&rsquo;s owner enters its results (or Meta Ads fills them in), and the goal
              adds the parts up.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-[11px]">Tags</Label>
          <GoalTagInput value={tags} onChange={setTags} suggestions={allTags} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!valid} loading={create.isPending}>
          <Plus className="h-4 w-4" /> Add goal
        </Button>
      </DialogFooter>
    </>
  )
}
