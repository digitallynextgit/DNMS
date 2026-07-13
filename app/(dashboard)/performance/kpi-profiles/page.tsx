"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  Plus,
  Trash2,
  Save,
  Sparkles,
  Search,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import {
  usePerfKpiProfile,
  usePerfKpiProfiles,
  useSavePerfKpiProfile,
  DEFAULT_KPI_PROFILE,
  SECTION_A_WEIGHT,
  SECTION_B_WEIGHT,
  type PerfKpiProfileRow,
  type EvalEvaluator,
  type EvalSection,
} from "@/features/performance"

interface Draft {
  evaluator: EvalEvaluator
  section: EvalSection
  label: string
  description: string
}

const SIDES: { key: EvalEvaluator; title: string; accent: string }[] = [
  { key: "MANAGER", title: "Manager evaluates", accent: "bg-blue-50/60 dark:bg-blue-950/20" },
  { key: "SELF", title: "Employee self-rates", accent: "bg-emerald-50/60 dark:bg-emerald-950/20" },
]

const SECTIONS: { key: EvalSection; title: string; noun: string; total: number }[] = [
  {
    key: "A",
    title: "Section A · Role Performance (KRA & KPI)",
    noun: "KPI",
    total: SECTION_A_WEIGHT,
  },
  {
    key: "B",
    title: "Section B · Workplace Discipline & Execution",
    noun: "Parameter",
    total: SECTION_B_WEIGHT,
  },
]

function ProfileEditor({ employeeId }: { employeeId: string }) {
  const { data, isLoading } = usePerfKpiProfile(employeeId)
  const save = useSavePerfKpiProfile(employeeId)
  const [draft, setDraft] = useState<Draft[]>([])

  // Seed the editor whenever a different employee's profile loads.
  useEffect(() => {
    if (!data) return
    setDraft(
      data.data.items.map((i) => ({
        evaluator: i.evaluator,
        section: i.section,
        label: i.label,
        description: i.description ?? "",
      })),
    )
  }, [data])

  const rowsFor = (evaluator: EvalEvaluator, section: EvalSection) =>
    draft
      .map((d, idx) => ({ d, idx }))
      .filter(({ d }) => d.evaluator === evaluator && d.section === section)

  function addRow(evaluator: EvalEvaluator, section: EvalSection) {
    setDraft((prev) => [...prev, { evaluator, section, label: "", description: "" }])
  }
  function updateRow(idx: number, patch: Partial<Draft>) {
    setDraft((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)))
  }
  function removeRow(idx: number) {
    setDraft((prev) => prev.filter((_, i) => i !== idx))
  }
  function loadDefaults() {
    setDraft(
      DEFAULT_KPI_PROFILE.map((d) => ({
        evaluator: d.evaluator,
        section: d.section,
        label: d.label,
        description: d.description ?? "",
      })),
    )
  }
  function handleSave() {
    const items = draft
      .filter((d) => d.label.trim())
      .map((d) => ({
        evaluator: d.evaluator,
        section: d.section,
        label: d.label.trim(),
        description: d.description.trim() || undefined,
      }))
    save.mutate(items)
  }

  const isEmpty = useMemo(() => draft.every((d) => !d.label.trim()), [draft])

  if (isLoading) return <ListSkeleton rows={4} height="h-24" />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={loadDefaults}>
          <Sparkles className="h-4 w-4" /> Load sheet defaults
        </Button>
        <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={save.isPending}>
          <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save profile"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {SIDES.map((side) => (
          <div key={side.key} className="space-y-4">
            <h3 className="text-sm font-semibold">{side.title}</h3>
            {SECTIONS.map((sec) => {
              const rows = rowsFor(side.key, sec.key)
              const each = rows.length > 0 ? Math.round((sec.total / rows.length) * 10) / 10 : 0
              return (
                <Card key={sec.key} className="overflow-hidden">
                  <CardHeader className={`py-2.5 ${side.accent}`}>
                    <CardTitle className="flex items-center justify-between text-xs">
                      <span>{sec.title}</span>
                      <span className="text-muted-foreground font-normal">
                        {rows.length} × {each}% = {sec.total}%
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-3">
                    {rows.length === 0 && (
                      <p className="text-muted-foreground py-2 text-center text-xs">
                        No {sec.noun.toLowerCase()}s yet.
                      </p>
                    )}
                    {rows.map(({ d, idx }) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="flex-1 space-y-1">
                          <Input
                            value={d.label}
                            placeholder={`${sec.noun} name`}
                            className="h-8 text-sm"
                            onChange={(e) => updateRow(idx, { label: e.target.value })}
                          />
                          <Input
                            value={d.description}
                            placeholder="Description (optional)"
                            className="text-muted-foreground h-7 text-xs"
                            onChange={(e) => updateRow(idx, { description: e.target.value })}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0"
                          onClick={() => removeRow(idx)}
                          aria-label="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground w-full justify-start gap-1.5"
                      onClick={() => addRow(side.key, sec.key)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add {sec.noun.toLowerCase()}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ))}
      </div>

      {isEmpty && (
        <p className="text-muted-foreground text-center text-xs">
          This profile is empty - evaluations will fall back to the standard sheet defaults until
          you set it.
        </p>
      )}
    </div>
  )
}

function StatusBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
      <CheckCircle2 className="h-3 w-3" /> Configured
    </span>
  ) : (
    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
      Using defaults
    </span>
  )
}

function EmployeeList({ onSelect }: { onSelect: (row: PerfKpiProfileRow) => void }) {
  const { data, isLoading } = usePerfKpiProfiles()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const rows = data?.data ?? []
  const q = search.trim().toLowerCase()
  const filtered = q
    ? rows.filter((r) =>
        `${r.firstName ?? ""} ${r.lastName ?? ""} ${r.employeeNo} ${r.department ?? ""}`
          .toLowerCase()
          .includes(q),
      )
    : rows

  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const columns: DataTableColumn<PerfKpiProfileRow>[] = [
    {
      header: "Employee",
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <AvatarDisplay
            src={r.profilePhoto}
            firstName={r.firstName ?? ""}
            lastName={r.lastName ?? ""}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {r.firstName} {r.lastName}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {r.employeeNo}
              {r.designation ? ` · ${r.designation}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: "Department",
      cell: (r) => <span className="text-muted-foreground">{r.department ?? "-"}</span>,
    },
    {
      header: "Manager KPIs",
      align: "center",
      className: "tabular-nums",
      cell: (r) => r.managerCount || <span className="text-muted-foreground">-</span>,
    },
    {
      header: "Self KPIs",
      align: "center",
      className: "tabular-nums",
      cell: (r) => r.selfCount || <span className="text-muted-foreground">-</span>,
    },
    { header: "Status", cell: (r) => <StatusBadge configured={r.configured} /> },
    {
      header: "",
      align: "right",
      cell: (r) => (
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          {r.configured ? "Edit" : "Set up"}
          <ChevronRight className="h-4 w-4" />
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search employee…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="h-9 pl-8"
        />
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} height="h-14" />
      ) : filtered.length === 0 ? (
        <EmptyState variant="card" title="No employees found." />
      ) : (
        <DataTable
          columns={columns}
          rows={paged}
          rowKey={(r) => r.id}
          onRowClick={onSelect}
          showSerial
          serialOffset={(currentPage - 1) * PAGE_SIZE}
          minWidth="min-w-[680px]"
          pagination={{
            page: currentPage,
            totalPages,
            total: filtered.length,
            onPageChange: setPage,
            itemLabel: "employee",
          }}
        />
      )}
    </div>
  )
}

export default function KpiProfilesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { status: sessionStatus } = useSession()
  const { can } = usePermissions()
  const canReview = can(PERMISSIONS.PERFORMANCE_REVIEW)

  // The employee whose profile is open (null = show the list).
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)

  // HR-only; everyone else uses their own performance page.
  useEffect(() => {
    if (sessionStatus === "authenticated" && !canReview) router.replace("/performance/me")
  }, [sessionStatus, canReview, router])

  // Deep-link support: /performance/kpi-profiles?employee=<id>
  useEffect(() => {
    const q = searchParams.get("employee")
    if (q) setSelected((s) => s ?? { id: q, name: "" })
  }, [searchParams])

  if (sessionStatus === "authenticated" && !canReview) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="KPI Profiles"
        description="Set each employee's KPIs (Section A) and parameters (Section B) for the manager and self sides. These are snapshotted onto every new evaluation."
      />

      {selected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 gap-1.5"
              onClick={() => setSelected(null)}
            >
              <ArrowLeft className="h-4 w-4" /> All employees
            </Button>
            {selected.name && (
              <span className="text-muted-foreground text-sm">
                Editing <span className="text-foreground font-medium">{selected.name}</span>
              </span>
            )}
          </div>
          <ProfileEditor key={selected.id} employeeId={selected.id} />
        </div>
      ) : (
        <EmployeeList
          onSelect={(r) =>
            setSelected({ id: r.id, name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() })
          }
        />
      )}
    </div>
  )
}
