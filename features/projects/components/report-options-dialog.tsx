"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MultiPicker, type MultiPickerOption as Option } from "@/components/shared/multi-picker"
import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import {
  REPORT_TYPES,
  reconcileConfig,
  reportType,
  sectionsFor,
  type ReportConfig,
  type ReportType,
  type ReportSection,
} from "../lib/report-options"

interface ScopeData {
  projects: { id: string; name: string; code: string | null }[]
  teams: {
    id: string
    name: string
    projectId: string
    projectName: string
    memberCount: number
  }[]
  people: { id: string; name: string; profilePhoto: string | null }[]
}

/** Staged like the date filter: nothing applies until Generate. */
export function ReportOptionsDialog({
  open,
  value,
  onOpenChange,
  onGenerate,
}: {
  open: boolean
  value: ReportConfig
  onOpenChange: (open: boolean) => void
  onGenerate: (config: ReportConfig) => void
}) {
  const [draft, setDraft] = useState<ReportConfig>(value)

  // Opening always starts from what is actually applied.
  const [prevOpen, setPrevOpen] = useState(open)
  const [prevValue, setPrevValue] = useState(value)
  if (open !== prevOpen || value !== prevValue) {
    setPrevOpen(open)
    setPrevValue(value)
    if (open) setDraft(value)
  }

  const { data: scope, isLoading } = useQuery({
    queryKey: ["performance-scope"],
    queryFn: () =>
      apiFetch<{ data: ScopeData }>("/api/projects/performance/scope").then((r) => r.data),
    enabled: open,
    staleTime: 5 * 60_000,
  })

  const def = reportType(draft.type)
  const sections = sectionsFor(draft.type)

  // Teams follow the chosen projects; an out-of-scope team would give an empty report.
  const teamOptions: Option[] = useMemo(() => {
    const all = scope?.teams ?? []
    const visible =
      draft.projectIds.length > 0 ? all.filter((t) => draft.projectIds.includes(t.projectId)) : all
    return visible.map((t) => ({
      id: t.id,
      label: t.name,
      hint: `${t.projectName} · ${t.memberCount} ${t.memberCount === 1 ? "member" : "members"}`,
    }))
  }, [scope, draft.projectIds])

  // A team that just fell out of project scope must not stay silently selected.
  const [prevTeamOptions, setPrevTeamOptions] = useState<Option[] | null>(null)
  if (teamOptions !== prevTeamOptions) {
    setPrevTeamOptions(teamOptions)
    const valid = new Set(teamOptions.map((t) => t.id))
    setDraft((d) =>
      d.teamIds.every((id) => valid.has(id))
        ? d
        : { ...d, teamIds: d.teamIds.filter((id) => valid.has(id)) },
    )
  }

  const projectOptions: Option[] = (scope?.projects ?? []).map((p) => ({
    id: p.id,
    label: p.name,
    hint: p.code ?? undefined,
  }))
  const peopleOptions: Option[] = (scope?.people ?? []).map((p) => ({ id: p.id, label: p.name }))

  const setType = (type: ReportType) => setDraft((d) => reconcileConfig({ ...d, type }))

  const toggleSection = (key: ReportSection) =>
    setDraft((d) => ({
      ...d,
      sections: d.sections.includes(key)
        ? d.sections.filter((s) => s !== key)
        : sections.filter((s) => s.key === key || d.sections.includes(s.key)).map((s) => s.key),
    }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Report options</DialogTitle>
          <DialogDescription className="text-xs">
            The date range comes from the filter on the page. Leave a scope empty to include
            everything in it.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Report type</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {REPORT_TYPES.map((t) => {
                const active = draft.type === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setType(t.key)}
                    className={cn(
                      "rounded-sm border p-2 text-left transition-colors",
                      active ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <Check
                        className={cn("h-3.5 w-3.5 shrink-0", active ? "opacity-100" : "opacity-0")}
                      />
                      {t.label}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block pl-5 text-[11px]">
                      {t.hint}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-16 rounded-sm" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {def.scopes.includes("projects") && (
                <MultiPicker
                  label="Projects"
                  options={projectOptions}
                  selected={draft.projectIds}
                  onChange={(projectIds) => setDraft((d) => ({ ...d, projectIds }))}
                  emptyLabel={`All projects (${projectOptions.length})`}
                />
              )}
              {def.scopes.includes("teams") && (
                <MultiPicker
                  label="Teams"
                  options={teamOptions}
                  selected={draft.teamIds}
                  onChange={(teamIds) => setDraft((d) => ({ ...d, teamIds }))}
                  emptyLabel={`All teams (${teamOptions.length})`}
                />
              )}
              {def.scopes.includes("people") && (
                <MultiPicker
                  label="People"
                  options={peopleOptions}
                  selected={draft.employeeIds}
                  onChange={(employeeIds) => setDraft((d) => ({ ...d, employeeIds }))}
                  emptyLabel={`Everyone (${peopleOptions.length})`}
                />
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-medium">
              Include in the report
              <span className="text-muted-foreground ml-1.5 font-normal">
                {draft.sections.length} of {sections.length}
              </span>
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {sections.map((s) => {
                const active = draft.sections.includes(s.key)
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleSection(s.key)}
                    className={cn(
                      "flex items-start gap-2 rounded-sm border p-2 text-left transition-colors",
                      active ? "border-primary/60 bg-primary/5" : "hover:bg-muted/50",
                    )}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">{s.label}</span>
                      <span className="text-muted-foreground block text-[11px] leading-snug">
                        {s.instruction}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setDraft((d) => ({ ...d, projectIds: [], teamIds: [], employeeIds: [] }))
            }
          >
            Reset scope
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={draft.sections.length === 0}
              onClick={() => onGenerate(draft)}
            >
              Generate
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
