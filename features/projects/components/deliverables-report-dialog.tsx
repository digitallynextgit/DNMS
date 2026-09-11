"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download, Loader2, Search } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { DateRangeField, type DateRangeValue } from "@/components/shared/date-range-field"
import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"

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

const SLIDES = [
  "Cover",
  "Who is in the report",
  "At a glance",
  "By project",
  "Every deliverable",
  "Not completed, and why",
  "By team member",
  "AI takeaways",
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The page's window. Seeds the dialog; the dialog can change it without touching the page. */
  range: DateRangeValue
  /** The page's project picker, when one project is selected. Preselected. */
  projectId?: string | null
}

export function DeliverablesReportDialog({ open, onOpenChange, range, projectId }: Props) {
  // `busy` lives here so a download in flight can hold the dialog open.
  const [busy, setBusy] = useState(false)

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        {/* Mounted per open, so every visit starts from what the page shows
            (its window, its project) instead of last time's picks. */}
        {open && (
          <ReportForm
            range={range}
            projectId={projectId ?? null}
            busy={busy}
            setBusy={setBusy}
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
  busy,
  setBusy,
  onClose,
}: {
  range: DateRangeValue
  projectId: string | null
  busy: boolean
  setBusy: (busy: boolean) => void
  onClose: () => void
}) {
  const scope = useQuery({
    queryKey: ["deliverables-report-scope"],
    queryFn: () =>
      apiFetch<{ data: ScopeData }>("/api/projects/deliverables/report/scope").then((r) => r.data),
    staleTime: 60_000,
  })

  const [window, setWindow] = useState<DateRangeValue>(range)
  const [mode, setMode] = useState<Mode>(projectId ? "projects" : "all")
  const [picked, setPicked] = useState<Set<string>>(() => new Set(projectId ? [projectId] : []))
  const [withAi, setWithAi] = useState(true)

  const data = scope.data
  const role = data?.role ?? "member"
  const copy = ROLE_COPY[role]

  const modes = useMemo(() => {
    const out: { key: Mode; label: string }[] = [{ key: "all", label: copy.all }]
    if (!data) return out
    if (data.projects.length > 1 || role !== "member")
      out.push({ key: "projects", label: "Projects" })
    if (data.teams.length > 0) out.push({ key: "teams", label: "Teams" })
    if (data.people.length > 1) out.push({ key: "people", label: "People" })
    return out
  }, [data, role, copy.all])

  const items = useMemo(() => {
    if (!data) return []
    if (mode === "projects") {
      return data.projects.map((p) => ({ id: p.id, label: p.name, sub: p.code ?? "" }))
    }
    if (mode === "teams") {
      return data.teams.map((t) => ({
        id: t.id,
        label: t.name,
        sub: `${t.projectName} · ${t.memberCount} member${t.memberCount === 1 ? "" : "s"}`,
      }))
    }
    if (mode === "people") {
      return data.people.map((e) => ({ id: e.id, label: e.name, sub: e.designation ?? "" }))
    }
    return []
  }, [data, mode])

  const choose = (next: Mode) => {
    setMode(next)
    setPicked(new Set())
  }
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const ready = !!window.from && !!window.to && (mode === "all" || picked.size > 0)

  const download = async () => {
    if (!window.from || !window.to) {
      toast.error("Pick a date window first")
      return
    }
    setBusy(true)
    try {
      const p = new URLSearchParams({ from: window.from, to: window.to, ai: withAi ? "1" : "0" })
      const ids = Array.from(picked).join(",")
      if (mode === "projects" && ids) p.set("projectIds", ids)
      if (mode === "teams" && ids) p.set("teamIds", ids)
      if (mode === "people" && ids) p.set("employeeIds", ids)

      const res = await fetch(`/api/projects/deliverables/report?${p.toString()}`)
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `The server said ${res.status}`)
      }
      const blob = await res.blob()
      const name =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        "deliverables.pptx"
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("Slides downloaded")
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the slides")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Deliverables slides</DialogTitle>
        <DialogDescription>
          A .pptx you can present: who was on it, what was to be done, what landed, what did not and
          why.
          {data ? ` You are generating as ${copy.who.toLowerCase()} - ${copy.hint}` : ""}
        </DialogDescription>
      </DialogHeader>

      {scope.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : scope.isError ? (
        <p className="text-destructive text-sm">Could not load what you can report on.</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">Window</p>
            <DateRangeField value={window} onChange={setWindow} />
          </div>

          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">Report on</p>
            <div className="flex flex-wrap gap-1.5">
              {modes.map((m) => (
                <Button
                  key={m.key}
                  type="button"
                  className="h-8 text-xs"
                  variant={mode === m.key ? "default" : "outline"}
                  onClick={() => choose(m.key)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>

          {mode !== "all" && <PickList items={items} picked={picked} onToggle={toggle} />}

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={withAi} onCheckedChange={(v) => setWithAi(v === true)} />
            Add an AI takeaways slide (speaker notes drafted from the numbers)
          </label>

          <p className="text-muted-foreground text-[11px]">
            Slides:{" "}
            {SLIDES.filter((s) =>
              role === "member" ? s !== "Who is in the report" && s !== "By team member" : true,
            ).join(" · ")}
          </p>
        </div>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button className="gap-1.5" onClick={download} disabled={!ready || busy || !data}>
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {busy ? "Building…" : "Download slides"}
        </Button>
      </DialogFooter>
    </>
  )
}

function PickList({
  items,
  picked,
  onToggle,
}: {
  items: { id: string; label: string; sub: string }[]
  picked: Set<string>
  onToggle: (id: string) => void
}) {
  const [q, setQ] = useState("")
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return items
    return items.filter(
      (i) => i.label.toLowerCase().includes(needle) || i.sub.toLowerCase().includes(needle),
    )
  }, [items, q])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="h-8 pl-8 text-sm"
        />
      </div>
      <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-md border p-1">
        {shown.length === 0 ? (
          <p className="text-muted-foreground px-2 py-3 text-center text-xs">Nothing matches.</p>
        ) : (
          shown.map((i) => {
            const on = picked.has(i.id)
            return (
              <label
                key={i.id}
                className={cn(
                  "hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm",
                  on && "bg-muted/60",
                )}
              >
                <Checkbox checked={on} onCheckedChange={() => onToggle(i.id)} />
                <span className="truncate">{i.label}</span>
                {i.sub && (
                  <span className="text-muted-foreground ml-auto shrink-0 truncate text-xs">
                    {i.sub}
                  </span>
                )}
              </label>
            )
          })
        )}
      </div>
      <p className="text-muted-foreground text-[11px]">
        {picked.size === 0 ? "Pick at least one." : `${picked.size} picked.`}
      </p>
    </div>
  )
}
