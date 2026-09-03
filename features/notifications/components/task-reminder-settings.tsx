"use client"

import { useEffect, useState } from "react"
import { BellRing } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import {
  useTaskReminderPreference,
  useUpdateTaskReminderPreference,
} from "../hooks/use-task-reminders"
import { DEFAULT_REMINDER_PREFERENCE, LEAD_MINUTE_PRESETS, REMINDER_LIMITS } from "../constants"
import { describeOffset, reminderOffsets } from "../lib/reminder-schedule"
import type { ReminderPreference } from "../types"

/**
 * Personal control over the "your time on this task is nearly up" reminder.
 *
 * The employee sets WHEN the first warning lands and HOW MANY follow. Rather
 * than describing that in prose, the card previews the exact schedule those
 * numbers produce - computed with the same function the cron uses, so what is
 * shown here is what will actually be sent.
 */
export function TaskReminderSettings() {
  const { data, isLoading } = useTaskReminderPreference()
  const updateMut = useUpdateTaskReminderPreference()
  const [form, setForm] = useState<ReminderPreference>(DEFAULT_REMINDER_PREFERENCE)

  // Seed the form once the saved values arrive, and re-seed after a save so the
  // fields always show what is actually stored.
  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const set = <K extends keyof ReminderPreference>(key: K, value: ReminderPreference[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const dirty = !!data && !samePreference(data, form)
  const offsets = reminderOffsets(form)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task time reminders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-10 w-full max-w-sm" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4" />
            Task time reminders
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Warns you as the hours booked for a task you have In Progress run out. A task booked for
            an hour and started at 10:00 is due at 11:00.
          </p>
        </div>
        <Switch
          checked={form.enabled}
          onCheckedChange={(enabled) => set("enabled", enabled)}
          aria-label="Enable task time reminders"
        />
      </CardHeader>

      <CardContent className="space-y-6">
        <fieldset
          disabled={!form.enabled}
          className={cn("space-y-6", !form.enabled && "pointer-events-none opacity-50")}
        >
          {/* ── When the first warning lands ─────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="leadMinutes">Warn me this many minutes before the time is up</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="leadMinutes"
                type="number"
                inputMode="numeric"
                min={REMINDER_LIMITS.leadMinutes.min}
                max={REMINDER_LIMITS.leadMinutes.max}
                value={form.leadMinutes}
                onChange={(e) => set("leadMinutes", toInt(e.target.value, form.leadMinutes))}
                className="w-28"
              />
              {LEAD_MINUTE_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={form.leadMinutes === preset ? "default" : "outline"}
                  onClick={() => set("leadMinutes", preset)}
                >
                  {preset} min
                </Button>
              ))}
            </div>
          </div>

          {/* ── How many, and how far apart ──────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reminderCount">How many times</Label>
              <Input
                id="reminderCount"
                type="number"
                inputMode="numeric"
                min={REMINDER_LIMITS.reminderCount.min}
                max={REMINDER_LIMITS.reminderCount.max}
                value={form.reminderCount}
                onChange={(e) => set("reminderCount", toInt(e.target.value, form.reminderCount))}
              />
              <p className="text-muted-foreground text-xs">
                Reminders per task, counted from when you start it.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repeatEveryMinutes">Minutes between reminders</Label>
              <Input
                id="repeatEveryMinutes"
                type="number"
                inputMode="numeric"
                min={REMINDER_LIMITS.repeatEveryMinutes.min}
                max={REMINDER_LIMITS.repeatEveryMinutes.max}
                value={form.repeatEveryMinutes}
                // Only the gap is meaningless with a single reminder; the field
                // stays visible so the layout does not jump when the count changes.
                disabled={form.reminderCount <= 1}
                onChange={(e) =>
                  set("repeatEveryMinutes", toInt(e.target.value, form.repeatEveryMinutes))
                }
              />
              <p className="text-muted-foreground text-xs">
                {form.reminderCount <= 1
                  ? "Only applies when you ask for more than one."
                  : "Applies after the first reminder."}
              </p>
            </div>
          </div>

          {/* ── What those numbers actually do ───────────────────────────── */}
          <div className="bg-muted/50 space-y-2 rounded-sm border p-3">
            <p className="text-sm font-medium">You will be reminded</p>
            <div className="flex flex-wrap gap-2">
              {offsets.map((offset, i) => (
                <span
                  key={i}
                  className={cn(
                    "bg-background rounded-sm border px-2 py-1 text-xs",
                    offset < 0 && "border-destructive/40 text-destructive",
                  )}
                >
                  {describeOffset(offset)}
                </span>
              ))}
            </div>
            {offsets.some((o) => o < 0) && (
              <p className="text-muted-foreground text-xs">
                Reminders past the deadline tell you how far over the booked time the task has run.
              </p>
            )}
          </div>
        </fieldset>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => updateMut.mutate(form)}
            disabled={!dirty || updateMut.isPending}
          >
            {updateMut.isPending ? "Saving..." : "Save"}
          </Button>
          {dirty && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => data && setForm(data)}
              disabled={updateMut.isPending}
            >
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/** Empty or non-numeric input keeps the last good value, so the field never
 *  submits NaN and the preview below it never blanks out mid-typing. */
function toInt(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : fallback
}

function samePreference(a: ReminderPreference, b: ReminderPreference): boolean {
  return (
    a.enabled === b.enabled &&
    a.leadMinutes === b.leadMinutes &&
    a.reminderCount === b.reminderCount &&
    a.repeatEveryMinutes === b.repeatEveryMinutes
  )
}
