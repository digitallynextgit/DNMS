"use client"

import { useState } from "react"
import { FileText, FileType2, Loader2, Presentation } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { WORK_REPORT_FORMAT_LABELS, WORK_REPORT_FORMATS, MAX_PEOPLE_PER_REPORT } from "../constants"
import { useWorkReportScope } from "../hooks/use-work-report-scope"
import { MAX_RANGE_DAYS, parseReportRange } from "../lib/report-format"
import type { WorkReportFormat } from "../types"

const FORMAT_ICON: Record<WorkReportFormat, typeof FileText> = {
  pptx: Presentation,
  pdf: FileText,
  docx: FileType2,
}

/** Saves the response as a file, named the way the server named it. */
async function saveResponse(res: Response, fallback: string) {
  const blob = await res.blob()
  const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? fallback
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * "Progress report" on Progress: a PowerPoint, PDF or Word report of what was worked on, day by day,
 * for the page's own range, people and project. People outside the reporter's reach are left out.
 */
export function WorkReportMenu({
  from,
  to,
  employeeIds,
  projectIds = [],
  whoLabel,
}: {
  from: string | null
  to: string | null
  /** The people the page is showing. */
  employeeIds: string[]
  /** Empty = every project. */
  projectIds?: string[]
  /** "Whole team", a person's name... */
  whoLabel?: string
}) {
  const scope = useWorkReportScope()
  const [busy, setBusy] = useState<WorkReportFormat | null>(null)
  const [withAi, setWithAi] = useState(true)

  // The report follows its own (stricter) rule: yourself, your reporting line, or HR/admin anyone.
  const allowed = new Set(scope.data?.people.map((p) => p.id) ?? [])
  const people = employeeIds.filter((id) => allowed.has(id))
  const leftOut = employeeIds.length - people.length
  const period = from && to ? parseReportRange(from, to) : null
  const today = new Date().toISOString().slice(0, 10)

  const problem = !scope.data
    ? null
    : !from || !to
      ? "Pick a date range first"
      : !period
        ? `Pick a range of at most ${MAX_RANGE_DAYS} days`
        : period.from > today
          ? "That period has not started yet"
          : people.length === 0
            ? "Nobody here is in your reporting line"
            : people.length > MAX_PEOPLE_PER_REPORT
              ? `Narrow it to ${MAX_PEOPLE_PER_REPORT} people or fewer`
              : null

  const download = async (format: WorkReportFormat) => {
    if (!period || problem) return
    setBusy(format)
    const toastId = toast.loading(`Building the ${WORK_REPORT_FORMAT_LABELS[format]} report...`)
    try {
      const p = new URLSearchParams({
        from: period.from,
        to: period.to,
        format,
        employeeIds: people.join(","),
        ai: withAi && scope.data?.aiAvailable ? "1" : "0",
      })
      if (projectIds.length) p.set("projectIds", projectIds.join(","))
      const res = await fetch(`/api/work-reports?${p.toString()}`)
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string | { message?: string }
        } | null
        const message = typeof body?.error === "string" ? body.error : body?.error?.message
        throw new Error(message ?? `The server said ${res.status}`)
      }
      await saveResponse(res, `progress-report.${format}`)
      toast.success("Report downloaded", { id: toastId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the report", { id: toastId })
    } finally {
      setBusy(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-1.5" disabled={busy !== null || !scope.data}>
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Presentation className="h-3.5 w-3.5" />
          )}
          Progress report
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block">Progress report{period ? ` · ${period.label}` : ""}</span>
          <span className="text-muted-foreground block text-xs font-normal">
            {people.length === 1 && employeeIds.length === 1
              ? (whoLabel ?? "One person")
              : `${whoLabel ? `${whoLabel} · ` : ""}${people.length} ${people.length === 1 ? "person" : "people"}`}
            {projectIds.length ? " · selected project" : ""}
          </span>
          {leftOut > 0 ? (
            <span className="text-muted-foreground block text-xs font-normal">
              {leftOut} outside your reporting line left out
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {problem ? (
          <p className="text-muted-foreground px-2 py-1.5 text-xs">{problem}</p>
        ) : (
          WORK_REPORT_FORMATS.map((format) => {
            const Icon = FORMAT_ICON[format]
            return (
              <DropdownMenuItem key={format} onSelect={() => void download(format)}>
                <Icon className="h-4 w-4" />
                {WORK_REPORT_FORMAT_LABELS[format]}
              </DropdownMenuItem>
            )
          })
        )}
        {scope.data?.aiAvailable ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={withAi}
              onCheckedChange={(v) => setWithAi(v === true)}
              onSelect={(e) => e.preventDefault()}
            >
              Polish highlights with AI
            </DropdownMenuCheckboxItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
