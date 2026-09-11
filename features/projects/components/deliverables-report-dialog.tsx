"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download, Loader2, FileSpreadsheet, FileText, Presentation } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import type { DateRangeValue } from "@/components/shared/date-range-field"
import { apiFetch } from "@/lib/api-fetch"
import { formatDate } from "@/lib/utils"

// =============================================================================
// Deliverables slides
//
// Picks WHAT the deck is about; the server decides what the caller may pick.
// A team manager sees their team and its members, an account manager every
// team on the projects they own, an admin everything, and a plain member gets
// no pickers at all - the deck is theirs and only theirs.
// =============================================================================

type Role = "admin" | "account_manager" | "team_manager" | "member"

interface ScopeData {
  role: Role
  projects: { id: string; name: string; code: string | null }[]
  teams: { id: string; name: string; projectId: string; projectName: string; memberCount: number }[]
  people: { id: string; name: string; designation: string | null; teamIds: string[] }[]
}

type Mode = "all" | "projects" | "teams" | "people"

const ROLE_COPY: Record<Role, { who: string; all: string; hint: string }> = {
  admin: {
    who: "Administrator",
    all: "Everything in the company",
    hint: "Any project, team or person. Leave it on everything for the whole portfolio.",
  },
  account_manager: {
    who: "Account manager",
    all: "Every project you own",
    hint: "The projects you own, their teams and the people on them.",
  },
  team_manager: {
    who: "Team manager",
    all: "Every team you manage",
    hint: "Your whole team, or just some of its members.",
  },
  member: {
    who: "Team member",
    all: "Your own deliverables",
    hint: "What you had to do and what you delivered in the window.",
  },
}


interface FilterSummary {
  projectLabel?: string
  teamLabel?: string
  personLabel?: string
  totalCount?: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  range: DateRangeValue
  projectId?: string | null
  teamIds?: string[]
  employeeId?: string | null
  filterSummary?: FilterSummary
}

export function DeliverablesReportDialog({
  open,
  onOpenChange,
  range,
  projectId,
  teamIds,
  employeeId,
  filterSummary,
}: Props) {
  const [exportingFormat, setExportingFormat] = useState<"xlsx" | "docx" | "pptx" | null>(null)

  return (
    <Dialog open={open} onOpenChange={(o) => exportingFormat === null && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <ReportForm
            range={range}
            projectId={projectId ?? null}
            teamIds={teamIds ?? []}
            employeeId={employeeId ?? null}
            filterSummary={filterSummary}
            exportingFormat={exportingFormat}
            setExportingFormat={setExportingFormat}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReportForm({
  range,
  projectId,
  teamIds,
  employeeId,
  filterSummary,
  exportingFormat,
  setExportingFormat,
  onClose,
}: {
  range: DateRangeValue
  projectId: string | null
  teamIds: string[]
  employeeId: string | null
  filterSummary?: FilterSummary
  exportingFormat: "xlsx" | "docx" | "pptx" | null
  setExportingFormat: (f: "xlsx" | "docx" | "pptx" | null) => void
  onClose: () => void
}) {
  const scope = useQuery({
    queryKey: ["deliverables-report-scope"],
    queryFn: () =>
      apiFetch<{ data: ScopeData }>("/api/projects/deliverables/report/scope").then((r) => r.data),
    staleTime: 60_000,
  })

  const [withAi, setWithAi] = useState(true)

  const data = scope.data
  const role = data?.role ?? "member"

  // Scope label for current view
  const scopeDesc =
    employeeId && filterSummary?.personLabel && filterSummary.personLabel !== "Whole team"
      ? `Person: ${filterSummary.personLabel}`
      : role === "member"
        ? "Your deliverables"
        : projectId && filterSummary?.projectLabel && filterSummary.projectLabel !== "All projects"
          ? `Project: ${filterSummary.projectLabel}`
          : teamIds.length && filterSummary?.teamLabel && filterSummary.teamLabel !== "All teams"
            ? `Team: ${filterSummary.teamLabel}`
            : role === "admin"
              ? "All projects & teams"
              : role === "account_manager"
                ? "Your owned projects"
                : role === "team_manager"
                  ? "Your managed teams"
                  : "Your deliverables"

  const download = async (format: "pptx" | "xlsx" | "docx") => {
    setExportingFormat(format)
    try {
      const p = new URLSearchParams({
        format,
        ai: withAi ? "1" : "0",
      })

      if (range.from && range.to) {
        p.set("from", range.from)
        p.set("to", range.to)
      }

      if (projectId && projectId !== "all") p.set("projectIds", projectId)
      if (teamIds.length) p.set("teamIds", teamIds.join(","))
      if (employeeId && employeeId !== "all") p.set("employeeIds", employeeId)

      const res = await fetch(`/api/projects/deliverables/report?${p.toString()}`)
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `The server said ${res.status}`)
      }
      const blob = await res.blob()
      const name =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `deliverables.${format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("Report downloaded")
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the report")
    } finally {
      setExportingFormat(null)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          Export Deliverables Report
        </DialogTitle>
        <DialogDescription>
          Export the exact deliverables, metrics, and progress you see on screen into your chosen format.
        </DialogDescription>
      </DialogHeader>

      {scope.isLoading ? (
        <div className="space-y-2 py-3">
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
      ) : (
        <div className="space-y-4 py-2">
          {/* Summary of current active view */}
          <div className="rounded-lg border bg-muted/40 p-3.5 text-xs space-y-2">
            <div className="font-semibold text-foreground text-[11px] tracking-wider uppercase text-muted-foreground">
              Current View to Export
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Period</span>
                <span className="font-medium text-foreground">
                  {range.from && range.to
                    ? `${formatDate(range.from, "d MMM yyyy")} – ${formatDate(range.to, "d MMM yyyy")}`
                    : "All time"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Scope</span>
                <span className="font-medium text-foreground truncate block" title={scopeDesc}>
                  {scopeDesc}
                </span>
              </div>
              {typeof filterSummary?.totalCount === "number" && (
                <div className="col-span-2 pt-0.5 border-t border-border/40">
                  <span className="text-muted-foreground">Deliverables in view: </span>
                  <span className="font-semibold text-foreground">
                    {filterSummary.totalCount} {filterSummary.totalCount === 1 ? "deliverable" : "deliverables"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <Checkbox checked={withAi} onCheckedChange={(v) => setWithAi(v === true)} />
            Include AI-generated summary and speaker takeaways
          </label>
        </div>
      )}

      <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between items-center pt-2">
        <Button variant="ghost" onClick={onClose} disabled={exportingFormat !== null}>
          Cancel
        </Button>
        <div className="flex flex-wrap gap-2 justify-end w-full sm:w-auto">
          <Button
            className="gap-1.5"
            variant="outline"
            onClick={() => download("xlsx")}
            disabled={exportingFormat !== null}
            title="Download formatted Excel workbook"
          >
            {exportingFormat === "xlsx" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
            Excel
          </Button>
          <Button
            className="gap-1.5"
            variant="outline"
            onClick={() => download("docx")}
            disabled={exportingFormat !== null}
            title="Download formatted Word report"
          >
            {exportingFormat === "docx" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            )}
            Word
          </Button>
          <Button
            className="gap-1.5"
            onClick={() => download("pptx")}
            disabled={exportingFormat !== null}
            title="Download presentation slides"
          >
            {exportingFormat === "pptx" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Presentation className="h-3.5 w-3.5 text-amber-500" />
            )}
            PowerPoint
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
