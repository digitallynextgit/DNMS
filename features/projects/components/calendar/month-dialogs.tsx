"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FormDialog } from "@/components/shared/form-dialog"
import {
  currentMonth,
  formatMonth,
  MONTH_LABELS,
  monthISO,
  parseMonth,
  shiftMonth,
  type CalendarSeries,
  type YearMonth,
} from "../../lib/calendar-months"
import type { WorkbookIndexEntry } from "../../lib/sheet-types"

// Two Selects, not a date picker: a calendar edition has a month, not a day.

type Series = CalendarSeries<WorkbookIndexEntry>

/** Years offered: a year either side of what the calendar already spans. */
function yearRange(series: Series | null): number[] {
  const now = new Date().getFullYear()
  const years = (series?.editions ?? [])
    .map((e) => parseMonth(e.periodMonth)?.year)
    .filter((y): y is number => typeof y === "number")
  const lo = Math.min(now - 1, ...(years.length ? years : [now]))
  const hi = Math.max(now + 1, ...(years.length ? years : [now]))
  const out: number[] = []
  for (let y = hi; y >= lo; y--) out.push(y)
  return out
}

function MonthYearFields({
  value,
  onChange,
  series,
}: {
  value: YearMonth
  onChange: (v: YearMonth) => void
  series: Series | null
}) {
  const years = React.useMemo(() => yearRange(series), [series])
  return (
    <div className="flex gap-2">
      <Select
        value={String(value.month0)}
        onValueChange={(v) => onChange({ ...value, month0: Number(v) })}
      >
        <SelectTrigger className="flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTH_LABELS.map((label, i) => (
            <SelectItem key={label} value={String(i)}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(value.year)}
        onValueChange={(v) => onChange({ ...value, year: Number(v) })}
      >
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

type StartFrom = "blank" | "edition" | "upload"

/** A native radio, so the options act as one keyboard group. */
function StartOption({
  checked,
  onSelect,
  title,
  hint,
}: {
  checked: boolean
  onSelect: () => void
  title: string
  hint: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="radio"
        name="new-month-start-from"
        checked={checked}
        onChange={onSelect}
        className="accent-primary mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer"
      />
      <span>
        {title}
        <span className="text-muted-foreground block text-xs">{hint}</span>
      </span>
    </label>
  )
}

/** Another month of an existing calendar: start blank, copy the newest edition's structure, or import a file. */
export function NewMonthDialog({
  open,
  onOpenChange,
  series,
  onCreate,
  onUpload,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  series: Series | null
  onCreate: (input: {
    name: string
    periodMonth: string
    copyFrom: { workbookId: string; structure: boolean; teamPlan: boolean } | null
  }) => void
  /** Hands off to the importer, which creates the month itself - nothing is created here. */
  onUpload: (input: {
    name: string
    periodMonth: string
    copyFrom: { workbookId: string; teamPlan: boolean } | null
  }) => void
  pending: boolean
}) {
  const newest = React.useMemo(
    () => (series?.editions ?? []).find((e) => e.periodMonth) ?? null,
    [series],
  )

  // Default to the month after the newest edition.
  const suggested = React.useMemo(() => {
    const from = parseMonth(newest?.periodMonth)
    return from ? shiftMonth(from, 1) : currentMonth()
  }, [newest])

  const [month, setMonth] = React.useState<YearMonth>(suggested)
  const [startFrom, setStartFrom] = React.useState<StartFrom>("edition")
  const [copyStructure, setCopyStructure] = React.useState(true)
  const [copyTeamPlan, setCopyTeamPlan] = React.useState(true)

  // Reseeds on open, and when the newest edition changes while open (`suggested` follows it).
  const [prevOpen, setPrevOpen] = React.useState(false)
  const [prevNewest, setPrevNewest] = React.useState(newest)
  if (open !== prevOpen || newest !== prevNewest) {
    setPrevOpen(open)
    setPrevNewest(newest)
    if (open) {
      setMonth(suggested)
      setStartFrom(newest ? "edition" : "blank")
      setCopyStructure(true)
      setCopyTeamPlan(true)
    }
  }

  const taken = React.useMemo(() => {
    const want = monthISO(month.year, month.month0).slice(0, 7)
    return (series?.editions ?? []).find((e) => e.periodMonth?.slice(0, 7) === want) ?? null
  }, [series, month])

  if (!series) return null

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      contentClassName="lg:max-w-lg"
      title={`New month · ${series.name}`}
      description="Another month of this calendar. The name stays the same - the month is what tells them apart."
      isPending={pending}
      submitDisabled={Boolean(taken)}
      submitLabel={startFrom === "upload" ? "Choose a file" : "Create month"}
      onSubmit={(e) => {
        e.preventDefault()
        if (taken) return
        const periodMonth = monthISO(month.year, month.month0)

        if (startFrom === "upload") {
          onUpload({
            name: series.name,
            periodMonth,
            // Structure comes from the file, so only the team plan is carried over.
            copyFrom: newest && copyTeamPlan ? { workbookId: newest.id, teamPlan: true } : null,
          })
          return
        }

        onCreate({
          name: series.name,
          periodMonth,
          copyFrom:
            startFrom === "edition" && newest
              ? { workbookId: newest.id, structure: copyStructure, teamPlan: copyTeamPlan }
              : null,
        })
      }}
    >
      <div className="space-y-2">
        <Label>Month</Label>
        <MonthYearFields value={month} onChange={setMonth} series={series} />
        {taken && (
          <p className="text-destructive text-xs">
            {formatMonth(taken.periodMonth)} already exists for this calendar.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Start it from</Label>

        <StartOption
          checked={startFrom === "blank"}
          onSelect={() => setStartFrom("blank")}
          title="Nothing"
          hint="The month opens with one blank tab."
        />

        {newest && (
          <>
            <StartOption
              checked={startFrom === "edition"}
              onSelect={() => setStartFrom("edition")}
              title={formatMonth(newest.periodMonth)}
              hint={`Carry its ${newest.tabs.length} ${
                newest.tabs.length === 1 ? "tab" : "tabs"
              } forward.`}
            />
            <div
              className={cn(
                "space-y-2 pl-6",
                startFrom !== "edition" && "pointer-events-none opacity-50",
              )}
            >
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <Checkbox
                  checked={copyStructure}
                  onCheckedChange={(v) => setCopyStructure(v === true)}
                  disabled={startFrom !== "edition"}
                  className="mt-0.5"
                />
                <span>
                  Tabs and columns
                  <span className="text-muted-foreground block text-xs">
                    The rows are never copied - the new month starts empty.
                  </span>
                </span>
              </label>
            </div>
          </>
        )}

        <StartOption
          checked={startFrom === "upload"}
          onSelect={() => setStartFrom("upload")}
          title="A file I upload"
          hint="Its tabs, columns and rows become the month. It need not look anything like the month before."
        />

        {newest && startFrom !== "blank" && (
          <div className="space-y-2 pl-6">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox
                checked={copyTeamPlan}
                onCheckedChange={(v) => setCopyTeamPlan(v === true)}
                className="mt-0.5"
              />
              <span>
                Team plan from {formatMonth(newest.periodMonth)}
                <span className="text-muted-foreground block text-xs">
                  Teams, their people and their quantities. Due dates and links are not carried over
                  - they belong to the month they were set for.
                </span>
              </span>
            </label>
          </div>
        )}
      </div>
    </FormDialog>
  )
}

/** Defaults to the month the calendar was created in, rather than parsing names like "(H2S-Sept)". */
export function SetMonthDialog({
  open,
  onOpenChange,
  workbook,
  series,
  onSave,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workbook: WorkbookIndexEntry | null
  series: Series | null
  onSave: (periodMonth: string | null) => void
  pending: boolean
}) {
  const initial = React.useMemo<YearMonth>(() => {
    const already = parseMonth(workbook?.periodMonth)
    if (already) return already
    const created = workbook?.updatedAt ? new Date(workbook.updatedAt) : new Date()
    return { year: created.getFullYear(), month0: created.getMonth() }
  }, [workbook])

  const [month, setMonth] = React.useState<YearMonth>(initial)
  const [prevOpen, setPrevOpen] = React.useState(false)
  const [prevInitial, setPrevInitial] = React.useState(initial)
  if (open !== prevOpen || initial !== prevInitial) {
    setPrevOpen(open)
    setPrevInitial(initial)
    if (open) setMonth(initial)
  }

  const clash = React.useMemo(() => {
    const want = monthISO(month.year, month.month0).slice(0, 7)
    return (
      (series?.editions ?? []).find(
        (e) => e.id !== workbook?.id && e.periodMonth?.slice(0, 7) === want,
      ) ?? null
    )
  }, [series, month, workbook])

  const onlyDatedEdition = React.useMemo(
    () => (series?.editions ?? []).filter((e) => e.periodMonth).length <= 1,
    [series],
  )

  if (!workbook) return null

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      contentClassName="lg:max-w-lg"
      title={`Set the month · ${workbook.name}`}
      description="Which month does this calendar cover? Nothing guesses it from the name - a wrong month files the calendar where nobody will look."
      isPending={pending}
      submitDisabled={Boolean(clash)}
      submitLabel="Set month"
      onSubmit={(e) => {
        e.preventDefault()
        if (clash) return
        onSave(monthISO(month.year, month.month0))
      }}
    >
      <div className="space-y-2">
        <Label>Month</Label>
        <MonthYearFields value={month} onChange={setMonth} series={series} />
        {clash && (
          <p className="text-destructive text-xs">
            {formatMonth(clash.periodMonth)} already exists for this calendar.
          </p>
        )}
      </div>

      {/* Only for the calendar's only dated edition; the server refuses a mix of dated and undated. */}
      {workbook.periodMonth && onlyDatedEdition && (
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground h-8 px-2 text-xs"
          disabled={pending}
          onClick={() => onSave(null)}
        >
          Remove the month instead
        </Button>
      )}
    </FormDialog>
  )
}
