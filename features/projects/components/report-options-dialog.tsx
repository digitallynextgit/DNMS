"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
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

interface Option {
  id: string
  label: string
  hint?: string
}

/**
 * Checkbox list in a popover. Empty selection means "everything", which is why
 * the trigger says "All …" rather than "None" - selecting nothing is the widest
 * report, not the narrowest one.
 */
function MultiPicker({
  label,
  options,
  selected,
  onChange,
  emptyLabel,
  disabled,
}: {
  label: string
  options: Option[]
  selected: string[]
  onChange: (ids: string[]) => void
  emptyLabel: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q),
    )
  }, [options, search])

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  const summary =
    selected.length === 0
      ? emptyLabel
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.label ?? "1 selected")
        : `${selected.length} selected`

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium">{label}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || options.length === 0}
            className="h-8 w-full justify-between gap-2 px-2.5 text-xs font-normal"
          >
            <span className="truncate">{options.length === 0 ? "Nothing available" : summary}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-56 p-0" align="start">
          {options.length > 8 && (
            <div className="relative border-b">
              <Search className="text-muted-foreground absolute top-2.5 left-2 h-3.5 w-3.5" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="h-9 rounded-none border-0 pl-7 text-xs focus-visible:ring-0"
              />
            </div>
          )}

          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground px-2 py-3 text-center text-xs">No matches</p>
            ) : (
              filtered.map((o) => {
                const active = selected.includes(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(o.id)}
                    className="hover:bg-muted flex w-full items-start gap-2 rounded-[2px] px-2 py-1.5 text-left text-xs"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate", active && "font-medium")}>
                        {o.label}
                      </span>
                      {o.hint && (
                        <span className="text-muted-foreground block truncate text-[11px]">
                          {o.hint}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {selected.length > 0 && (
            <div className="border-t p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-full text-xs"
                onClick={() => onChange([])}
              >
                Clear ({selected.length})
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

/**
 * Builds the AI briefing request: what kind of report, over how much, containing
 * which sections.
 *
 * Staged like the date filter - nothing takes effect until Generate, so a
 * half-built config never fires a request.
 */
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
  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const { data: scope, isLoading } = useQuery({
    queryKey: ["performance-scope"],
    queryFn: () =>
      apiFetch<{ data: ScopeData }>("/api/projects/performance/scope").then((r) => r.data),
    enabled: open,
    staleTime: 5 * 60_000,
  })

  const def = reportType(draft.type)
  const sections = sectionsFor(draft.type)

  // Teams follow the chosen projects: offering a team from a project that is not
  // in scope would produce an empty report with no explanation.
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
  useEffect(() => {
    const valid = new Set(teamOptions.map((t) => t.id))
    setDraft((d) =>
      d.teamIds.every((id) => valid.has(id))
        ? d
        : { ...d, teamIds: d.teamIds.filter((id) => valid.has(id)) },
    )
  }, [teamOptions])

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
        : // Keep canonical order regardless of click order, so the report reads
          // the same way every time.
          sections.filter((s) => s.key === key || d.sections.includes(s.key)).map((s) => s.key),
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
          {/* Type */}
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
                      "rounded-[2px] border p-2 text-left transition-colors",
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

          {/* Scope */}
          {isLoading ? (
            <Skeleton className="h-16 rounded-[2px]" />
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

          {/* Sections */}
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
                      "flex items-start gap-2 rounded-[2px] border p-2 text-left transition-colors",
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
            size="sm"
            className="text-xs"
            onClick={() =>
              setDraft((d) => ({ ...d, projectIds: [], teamIds: [], employeeIds: [] }))
            }
          >
            Reset scope
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
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
