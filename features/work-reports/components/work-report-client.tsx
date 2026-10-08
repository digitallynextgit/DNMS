"use client"

import { useMemo, useState } from "react"
import { FileText, FileType2, Loader2, Presentation } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { MonthNav } from "@/components/shared/month-nav"
import { MultiPicker } from "@/components/shared/multi-picker"
import { PageHeader } from "@/components/shared/page-header"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { WORK_REPORT_FORMAT_LABELS } from "../constants"
import { useWorkReportScope } from "../hooks/use-work-report-scope"
import { parseReportMonth, shiftMonth } from "../lib/report-format"
import type { WorkReportFormat } from "../types"

// Work report: picks the month and people; the server decides who the caller may pick.

type Who = "me" | "team" | "pick"

const FORMAT_ICONS: Record<WorkReportFormat, React.ElementType> = {
  pptx: Presentation,
  pdf: FileText,
  docx: FileType2,
}

const currentMonth = () => {
  const ist = new Date(Date.now() + 5.5 * 3_600_000)
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`
}

export function WorkReportClient() {
  const { data: scope, isLoading } = useWorkReportScope()
  // null until the user moves off the default (the month before today).
  const [chosenMonth, setMonth] = useState<string | null>(null)
  const [who, setWho] = useState<Who>("me")
  const [picked, setPicked] = useState<string[]>([])
  const [withAi, setWithAi] = useState(true)
  const [busy, setBusy] = useState<WorkReportFormat | null>(null)

  const month = chosenMonth ?? scope?.defaultMonth ?? null

  const me = scope?.people.find((p) => p.isMe)
  const team = useMemo(() => scope?.people.filter((p) => p.inTeam) ?? [], [scope])
  const canPick = scope ? scope.role !== "member" : false

  const employeeIds = useMemo(() => {
    if (!scope || !me) return []
    if (who === "team") return [me.id, ...team.map((p) => p.id)]
    if (who === "pick") return picked
    return [me.id]
  }, [scope, me, team, who, picked])

  const period = month ? parseReportMonth(month) : null
  const thisMonth = currentMonth()

  const whoOptions = [
    { value: "me" as const, label: "Just me" },
    ...(team.length ? [{ value: "team" as const, label: `My team (${team.length + 1})` }] : []),
    { value: "pick" as const, label: "Choose people" },
  ]

  const download = async (format: WorkReportFormat) => {
    if (!month || employeeIds.length === 0) return
    setBusy(format)
    try {
      const p = new URLSearchParams({
        month,
        format,
        employeeIds: employeeIds.join(","),
        ai: withAi && scope?.aiAvailable ? "1" : "0",
      })
      const res = await fetch(`/api/work-reports?${p.toString()}`)
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string | { message?: string }
        } | null
        const message = typeof body?.error === "string" ? body.error : body?.error?.message
        throw new Error(message ?? `The server said ${res.status}`)
      }
      const blob = await res.blob()
      const name =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `work-report.${format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("Report downloaded")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the report")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work report"
        description="A month-end report of what was worked on, day by day, with hours per project - from DNMS tasks, the task clock and attendance."
      />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Build a report</CardTitle>
          <CardDescription>
            {scope?.role === "member"
              ? "Your own report for the month you pick."
              : scope?.role === "admin"
                ? "Yourself, your team, or anyone in the company."
                : "Yourself, your whole team, or just some of the people who report to you."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading || !scope || !period ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-10 w-80" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Month</Label>
                <div className="flex items-center gap-3">
                  <MonthNav
                    year={Number(period.month.slice(0, 4))}
                    month={Number(period.month.slice(5)) - 1}
                    onPrev={() => setMonth(shiftMonth(period.month, -1))}
                    onNext={() => setMonth(shiftMonth(period.month, 1))}
                    canNext={period.month < thisMonth}
                  />
                  {period.month === thisMonth && (
                    <span className="text-muted-foreground text-xs">Month to date</span>
                  )}
                </div>
              </div>

              {canPick && (
                <div className="space-y-2">
                  <Label>Who</Label>
                  <SegmentedControl value={who} onChange={setWho} options={whoOptions} />
                  {who === "pick" && (
                    <MultiPicker
                      label="People"
                      options={scope.people.map((p) => ({
                        id: p.id,
                        label: p.isMe ? `${p.name} (me)` : p.name,
                        hint:
                          [p.designation, p.department].filter(Boolean).join(" · ") || undefined,
                      }))}
                      selected={picked}
                      onChange={setPicked}
                      emptyLabel="Nobody selected yet"
                    />
                  )}
                  <p className="text-muted-foreground text-xs">
                    {employeeIds.length === 0
                      ? "Pick at least one person."
                      : employeeIds.length === 1
                        ? "One person - their own report."
                        : `${employeeIds.length} people in one report, with a team overview first.`}
                  </p>
                </div>
              )}

              {scope.aiAvailable && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="work-report-ai"
                    checked={withAi}
                    onCheckedChange={(v) => setWithAi(v === true)}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="work-report-ai">Polish highlights with AI</Label>
                    <p className="text-muted-foreground text-xs">
                      Rewrites rough task titles into plain sentences. It only uses what is in DNMS
                      and adds nothing; if AI is unavailable the report is built without it.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Download as</Label>
                <div className="flex flex-wrap gap-2">
                  {(["pptx", "pdf", "docx"] as const).map((format) => {
                    const Icon = FORMAT_ICONS[format]
                    return (
                      <Button
                        key={format}
                        variant={format === "pptx" ? "default" : "outline"}
                        disabled={busy !== null || employeeIds.length === 0}
                        onClick={() => download(format)}
                      >
                        {busy === format ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                        {WORK_REPORT_FORMAT_LABELS[format]}
                      </Button>
                    )
                  })}
                </div>
              </div>

              <p className="text-muted-foreground border-t pt-4 text-xs">
                Hours come from each task&apos;s In Progress time, counted within office hours only.
                Weekends, holidays and full-day leave are left out; a task left In Progress
                overnight counts on the day it started, up to its estimate; two tasks running at
                once share the time.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
