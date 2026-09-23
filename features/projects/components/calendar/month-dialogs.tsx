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

// =============================================================================
// Starting another month of a calendar, and giving a legacy one a month.
//
// Both are two <Select>s rather than a date picker, and that is the point: a
// date picker asks for a DAY the model does not have. Somebody picks the 14th
// and then wonders why the calendar reads "October".
// =============================================================================

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

/** Where a new month's tabs and columns come from. */
type StartFrom = "blank" | "edition" | "upload"

/**
 * One row of the "Start it from" choice. A native radio, so the three options
 * behave as one group under the keyboard; the styling matches the Checkbox rows
 * it sits beside.
 */
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

/**
 * Another month of a calendar that already exists.
 *
 * The copy options are the reason this is worth a dialog rather than a button.
 * A month that starts empty means rebuilding the columns every time, and a
 * month that copies everything means last month's posts appear in this month's
 * grid - so the dialog says exactly what travels and what does not.
 *
 * The third option, a file, exists because a month is often PLANNED elsewhere:
 * October arrives as a spreadsheet that need not resemble September at all.
 * Before it, the only way in was to create the month empty and then import into
 * it, which meant the blank tab the month was born with had to be cleaned up
 * afterwards.
 */
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
  /**
   * Chosen "A file I upload": hand off to the importer, which creates the month
   * itself from the file's tabs.
   *
   * Nothing is created here on purpose - a month made up-front would occupy the
   * month's unique slot and have to be deleted again if the file picker is then
   * abandoned.
   */
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

  // Default to the month after the newest edition, which is the month somebody
  // opening this dialog almost always wants.
  const suggested = React.useMemo(() => {
    const from = parseMonth(newest?.periodMonth)
    return from ? shiftMonth(from, 1) : currentMonth()
  }, [newest])

  const [month, setMonth] = React.useState<YearMonth>(suggested)
  const [startFrom, setStartFrom] = React.useState<StartFrom>("edition")
  const [copyStructure, setCopyStructure] = React.useState(true)
  const [copyTeamPlan, setCopyTeamPlan] = React.useState(true)

  React.useEffect(() => {
    if (open) {
      setMonth(suggested)
      setStartFrom(newest ? "edition" : "blank")
      setCopyStructure(true)
      setCopyTeamPlan(true)
    }
  }, [open, suggested, newest])

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
      // The file path does not create anything yet - it opens the importer - so
      // the button says what happens next rather than promising a month.
      submitLabel={startFrom === "upload" ? "Choose a file" : "Create month"}
      onSubmit={(e) => {
        e.preventDefault()
        if (taken) return
        const periodMonth = monthISO(month.year, month.month0)

        if (startFrom === "upload") {
          onUpload({
            name: series.name,
            periodMonth,
            // Structure comes from the FILE, so the only thing worth carrying
            // over is who is on the hook.
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

        {/* Three exclusive choices, so native radios: they come with arrow-key
            navigation and a real group, which three checkboxes pretending to be
            exclusive would not. */}
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
                  {/* Said out loud, because it is the thing people assume goes
                      the other way - and a month that opens full is a month
                      where last month's plan gets shipped by mistake. */}
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

        {/* Shared by both copy paths, so it sits outside them. The team plan is
            about who is on the hook, which is independent of what the grid looks
            like - an uploaded file has no opinion about it. */}
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

/**
 * Give a calendar that has no month one - or move it to another.
 *
 * The migration path off the "(H2S-Sept)" names. It defaults to the month the
 * calendar was CREATED in rather than parsing the name: "(H2S-Sept)" could be
 * September 2025 or September 2026, and a calendar silently filed under the
 * wrong month is one nobody thinks to look for. Real data, usually right, and
 * a person confirms it.
 */
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
  React.useEffect(() => {
    if (open) setMonth(initial)
  }, [open, initial])

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

      {/* Only offered when this is the calendar's ONLY dated edition. A name on
          a project is either a series of months or one undated calendar, never
          a mix - so clearing the month here while September and November keep
          theirs is a state the server refuses, and a button that always errors
          is worse than no button. */}
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
