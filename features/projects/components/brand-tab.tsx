"use client"

import { useEffect, useRef, useState } from "react"
import { Spinner } from "@/components/shared/spinner"
import {
  Save,
  Plus,
  Trash2,
  Upload,
  Download,
  FileText,
  Target,
  Megaphone,
  Palette,
  Sparkles,
  ClipboardList,
  CalendarDays,
  Pencil,
  ImageIcon,
  FileDown,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { DateField } from "@/components/shared/date-field"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { CONTENT_CALENDAR_STATUS_COLORS, CONTENT_CALENDAR_STATUS_LABELS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import {
  useProjectBrand,
  useSaveProjectBrand,
  useUploadBrandAsset,
  useDeleteBrandAsset,
  useContentCalendar,
  useCreateEntry,
  useUpdateEntry,
  useDeleteEntry,
  useImportCalendar,
} from "@/features/projects/hooks/use-brand"
import {
  PLATFORMS,
  CONTENT_FORMATS,
  CALENDAR_STATUSES,
  MANIFESTATION_THEMES,
  EMPTY_GUIDELINES,
  emptyManifestation,
  type DigitalObjective,
  type BrandGuidelines,
  type Manifestation,
  type ProjectBrandData,
  type ContentEntry,
} from "@/features/projects/brand"

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random())
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

interface Props {
  projectId: string
  canManage: boolean
}

export function BrandTab({ projectId, canManage }: Props) {
  return (
    <Tabs defaultValue="strategy" className="mt-4 space-y-5">
      <TabsList>
        <TabsTrigger value="strategy" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Strategy
        </TabsTrigger>
        <TabsTrigger value="calendar" className="gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> Content Calendar
        </TabsTrigger>
      </TabsList>
      <TabsContent value="strategy">
        <StrategySection projectId={projectId} canManage={canManage} />
      </TabsContent>
      <TabsContent value="calendar">
        <ContentCalendarSection projectId={projectId} canManage={canManage} />
      </TabsContent>
    </Tabs>
  )
}

// ─── A section card with its own Save button ──────────────────────────────────

function SectionCard({
  icon: Icon,
  tint,
  step,
  title,
  description,
  canManage,
  dirty,
  saving,
  onSave,
  children,
}: {
  icon: React.ElementType
  tint: string
  step: number
  title: string
  description: string
  canManage: boolean
  dirty: boolean
  saving: boolean
  onSave: () => void
  children: React.ReactNode
}) {
  return (
    <Card className={cn("overflow-hidden transition-shadow", dirty && "ring-primary/30 ring-1")}>
      <CardHeader className="bg-muted/30 flex flex-row items-start justify-between gap-3 space-y-0 border-b py-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded", tint)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground/70 text-xs font-normal tabular-nums">
                {step}
              </span>
              {title}
            </CardTitle>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{description}</p>
          </div>
        </div>
        {canManage && (
          <div className="flex shrink-0 items-center gap-2">
            {dirty && (
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                Unsaved
              </span>
            )}
            <Button
              size="sm"
              variant={dirty ? "default" : "outline"}
              className="h-8 gap-1.5"
              disabled={!dirty || saving}
              onClick={onSave}
            >
              {saving ? <Spinner size="sm" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  )
}

// ─── Strategy ─────────────────────────────────────────────────────────────────

const THEME_ACCENT: Record<string, string> = {
  AWARENESS: "border-l-blue-500 bg-blue-50/40 dark:bg-blue-950/20",
  DEMAND: "border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20",
  THOUGHT: "border-l-violet-500 bg-violet-50/40 dark:bg-violet-950/20",
  COMMUNITY: "border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20",
}

function StrategySection({ projectId, canManage }: Props) {
  const { data, isLoading } = useProjectBrand(projectId)
  const save = useSaveProjectBrand(projectId)
  const upload = useUploadBrandAsset(projectId)
  const delAsset = useDeleteBrandAsset(projectId)

  const [brief, setBrief] = useState("")
  const [overview, setOverview] = useState("")
  const [objectives, setObjectives] = useState<DigitalObjective[]>([])
  const [manifestation, setManifestation] = useState<Manifestation>(emptyManifestation())
  const [guidelines, setGuidelines] = useState<BrandGuidelines>(EMPTY_GUIDELINES)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const d = data?.data
  const origBrief = d?.brief ?? ""
  const origOverview = d?.overview ?? ""
  const origObjectives = Array.isArray(d?.objectives) ? d!.objectives : []
  const origManifestation = { ...emptyManifestation(), ...(d?.manifestation ?? {}) }
  const origGuidelines = { ...EMPTY_GUIDELINES, ...(d?.guidelines ?? {}) }

  useEffect(() => {
    if (!d) return
    setBrief(d.brief ?? "")
    setOverview(d.overview ?? "")
    setObjectives(Array.isArray(d.objectives) ? d.objectives : [])
    setManifestation({ ...emptyManifestation(), ...(d.manifestation ?? {}) })
    setGuidelines({ ...EMPTY_GUIDELINES, ...(d.guidelines ?? {}) })
  }, [d])

  const assets = d?.assets ?? []
  const briefFiles = assets.filter((a) => a.kind === "BRIEF")
  const logoFiles = assets.filter((a) => a.kind === "LOGO")

  function saveSection(key: string, payload: Partial<ProjectBrandData>) {
    setSavingKey(key)
    save.mutate(payload, { onSettled: () => setSavingKey(null) })
  }

  if (isLoading) return <ListSkeleton rows={4} height="h-32" />

  const objectiveColumns: DataTableColumn<DigitalObjective>[] = [
    {
      header: "Platform",
      cell: (o) => (
        <Select
          value={o.platform || undefined}
          onValueChange={(v) => updateObj(setObjectives, o.id, { platform: v })}
          disabled={!canManage}
        >
          <SelectTrigger>
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            {PLATFORMS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      header: "Metric",
      cell: (o) => (
        <Input
          className="h-9"
          placeholder="e.g. Followers"
          value={o.metric}
          disabled={!canManage}
          onChange={(e) => updateObj(setObjectives, o.id, { metric: e.target.value })}
        />
      ),
    },
    {
      header: "Current",
      headClassName: "w-24",
      cell: (o) => (
        <Input
          className="h-9"
          placeholder="0"
          value={o.current}
          disabled={!canManage}
          onChange={(e) => updateObj(setObjectives, o.id, { current: e.target.value })}
        />
      ),
    },
    {
      header: "Target",
      headClassName: "w-24",
      cell: (o) => (
        <Input
          className="h-9"
          placeholder="0"
          value={o.target}
          disabled={!canManage}
          onChange={(e) => updateObj(setObjectives, o.id, { target: e.target.value })}
        />
      ),
    },
    {
      header: "Deadline",
      headClassName: "w-40",
      cell: (o) =>
        canManage ? (
          <DateField
            value={o.deadline}
            placeholder="Deadline"
            onChange={(v) => updateObj(setObjectives, o.id, { deadline: v })}
          />
        ) : (
          <span className="text-sm">{o.deadline || "-"}</span>
        ),
    },
    {
      header: "",
      align: "right",
      headClassName: "w-9",
      cell: (o) =>
        canManage ? (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setObjectives((p) => p.filter((x) => x.id !== o.id))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      {/* 1 · Brand Brief */}
      <SectionCard
        step={1}
        icon={FileText}
        tint="bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
        title="Brand Brief"
        description="The brief provided by the client."
        canManage={canManage}
        dirty={brief !== origBrief}
        saving={savingKey === "brief"}
        onSave={() => saveSection("brief", { brief })}
      >
        <Textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          disabled={!canManage}
          rows={5}
          placeholder="Paste or write the client's brand brief…"
        />
        <AssetRow
          label="Brief documents"
          files={briefFiles}
          canManage={canManage}
          uploading={upload.isPending}
          onUpload={(file) => upload.mutate({ file, kind: "BRIEF" })}
          onDelete={(id) => delAsset.mutate(id)}
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,image/*"
        />
      </SectionCard>

      {/* 2 · Digital Objectives */}
      <SectionCard
        step={2}
        icon={Target}
        tint="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
        title="Digital Objectives"
        description="Targets per platform - followers, likes, reach…"
        canManage={canManage}
        dirty={!same(objectives, origObjectives)}
        saving={savingKey === "objectives"}
        onSave={() => saveSection("objectives", { objectives })}
      >
        {objectives.length === 0 ? (
          <EmptyState icon={Target} compact title="No objectives yet - add your first target." />
        ) : (
          <DataTable
            columns={objectiveColumns}
            rows={objectives}
            rowKey={(o) => o.id}
            showSerial
            minWidth="min-w-[680px]"
          />
        )}
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() =>
              setObjectives((p) => [
                ...p,
                { id: uid(), platform: "", metric: "", current: "", target: "", deadline: "" },
              ])
            }
          >
            <Plus className="h-3.5 w-3.5" /> Add objective
          </Button>
        )}
      </SectionCard>

      {/* 3 · Manifestation Plan */}
      <SectionCard
        step={3}
        icon={Megaphone}
        tint="bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
        title="Manifestation Plan"
        description="How each theme shows up on social media and the website."
        canManage={canManage}
        dirty={!same(manifestation, origManifestation)}
        saving={savingKey === "manifestation"}
        onSave={() => saveSection("manifestation", { manifestation })}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {MANIFESTATION_THEMES.map((t) => (
            <div key={t.key} className={cn("rounded border border-l-4 p-3", THEME_ACCENT[t.key])}>
              <p className="text-sm font-semibold">{t.title}</p>
              <p className="text-muted-foreground mb-2.5 text-xs">{t.hint}</p>
              <div className="space-y-2">
                <div>
                  <Label className="text-muted-foreground text-[11px]">Social media</Label>
                  <Textarea
                    rows={2}
                    className="bg-background mt-1"
                    disabled={!canManage}
                    placeholder="Themes, content pillars, post types…"
                    value={manifestation[t.key]?.social ?? ""}
                    onChange={(e) =>
                      setManifestation((m) => ({
                        ...m,
                        [t.key]: {
                          ...(m[t.key] ?? { social: "", website: "" }),
                          social: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-[11px]">Website</Label>
                  <Textarea
                    rows={2}
                    className="bg-background mt-1"
                    disabled={!canManage}
                    placeholder="Pages, sections, campaigns…"
                    value={manifestation[t.key]?.website ?? ""}
                    onChange={(e) =>
                      setManifestation((m) => ({
                        ...m,
                        [t.key]: {
                          ...(m[t.key] ?? { social: "", website: "" }),
                          website: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 4 · Brand Overview */}
      <SectionCard
        step={4}
        icon={ClipboardList}
        tint="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
        title="Brand Overview"
        description="The strategy document built from the above + competitor & market research."
        canManage={canManage}
        dirty={overview !== origOverview}
        saving={savingKey === "overview"}
        onSave={() => saveSection("overview", { overview })}
      >
        <Textarea
          value={overview}
          onChange={(e) => setOverview(e.target.value)}
          disabled={!canManage}
          rows={7}
          placeholder="Positioning, competitor landscape, market research, key takeaways…"
        />
      </SectionCard>

      {/* 5 · Brand Guidelines */}
      <SectionCard
        step={5}
        icon={Palette}
        tint="bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
        title="Brand Guidelines"
        description="Logos, colors, fonts, UI/UX direction."
        canManage={canManage}
        dirty={!same(guidelines, origGuidelines)}
        saving={savingKey === "guidelines"}
        onSave={() => saveSection("guidelines", { guidelines })}
      >
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground text-[11px]">Colors</Label>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {guidelines.colors.map((c, i) => (
                <div
                  key={i}
                  className="bg-muted/30 group flex items-center gap-2 rounded border px-2 py-1.5"
                >
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#000000"}
                    disabled={!canManage}
                    onChange={(e) => updateColor(setGuidelines, i, { hex: e.target.value })}
                    className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <div className="flex flex-col">
                    <Input
                      className="h-6 w-24 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                      placeholder="Name"
                      value={c.name}
                      disabled={!canManage}
                      onChange={(e) => updateColor(setGuidelines, i, { name: e.target.value })}
                    />
                    <span className="text-muted-foreground px-1 font-mono text-[10px] uppercase">
                      {c.hex}
                    </span>
                  </div>
                  {canManage && (
                    <button
                      className="text-muted-foreground hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() =>
                        setGuidelines((g) => ({ ...g, colors: g.colors.filter((_, j) => j !== i) }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-[46px] gap-1.5 border-dashed"
                  onClick={() =>
                    setGuidelines((g) => ({
                      ...g,
                      colors: [...g.colors, { name: "", hex: "#4f46e5" }],
                    }))
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Color
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">Fonts</Label>
              <Input
                value={guidelines.fonts}
                disabled={!canManage}
                placeholder="e.g. Inter, Poppins"
                onChange={(e) => setGuidelines((g) => ({ ...g, fonts: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">UI / UX direction</Label>
              <Input
                value={guidelines.uiux}
                disabled={!canManage}
                placeholder="Tone, layout, imagery style…"
                onChange={(e) => setGuidelines((g) => ({ ...g, uiux: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[11px]">Logo notes</Label>
            <Textarea
              rows={2}
              value={guidelines.logoNotes}
              disabled={!canManage}
              placeholder="Logo usage, clear space, do's & don'ts…"
              onChange={(e) => setGuidelines((g) => ({ ...g, logoNotes: e.target.value }))}
            />
          </div>

          <AssetRow
            label="Logos & guideline files"
            files={logoFiles}
            canManage={canManage}
            uploading={upload.isPending}
            onUpload={(file) => upload.mutate({ file, kind: "LOGO" })}
            onDelete={(id) => delAsset.mutate(id)}
            accept="image/*,.pdf,.ai,.svg,.zip"
            icon={ImageIcon}
          />
        </div>
      </SectionCard>
    </div>
  )
}

function updateObj(
  set: React.Dispatch<React.SetStateAction<DigitalObjective[]>>,
  id: string,
  patch: Partial<DigitalObjective>,
) {
  set((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
}
function updateColor(
  set: React.Dispatch<React.SetStateAction<BrandGuidelines>>,
  i: number,
  patch: Partial<{ name: string; hex: string }>,
) {
  set((g) => ({ ...g, colors: g.colors.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
}

// ─── Files (uploads are saved immediately, not part of a section's Save) ───────

function AssetRow({
  label,
  files,
  canManage,
  uploading,
  onUpload,
  onDelete,
  accept,
  icon: Icon = FileText,
}: {
  label: string
  files: ProjectBrandData["assets"]
  canManage: boolean
  uploading: boolean
  onUpload: (file: File) => void
  onDelete: (id: string) => void
  accept?: string
  icon?: React.ElementType
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="mt-4 space-y-1.5 border-t pt-3">
      <Label className="text-muted-foreground text-[11px]">{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {files.map((f) => (
          <span
            key={f.id}
            className="bg-muted/40 group flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs"
          >
            <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <a
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="max-w-44 truncate font-medium hover:underline"
            >
              {f.fileName}
            </a>
            <a href={f.url} target="_blank" rel="noreferrer" title="Download">
              <Download className="text-muted-foreground hover:text-foreground h-3.5 w-3.5" />
            </a>
            {canManage && (
              <button
                className="text-muted-foreground hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => onDelete(f.id)}
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}
        {canManage && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onUpload(file)
                e.target.value = ""
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-dashed"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Spinner size="sm" /> : <Upload className="h-3.5 w-3.5" />}
              Upload file
            </Button>
          </>
        )}
        {files.length === 0 && !canManage && (
          <span className="text-muted-foreground text-xs">No files.</span>
        )}
      </div>
    </div>
  )
}

// ─── Content Calendar ─────────────────────────────────────────────────────────

const emptyEntry = (): Omit<ContentEntry, "id"> => ({
  date: null,
  platform: null,
  theme: null,
  format: null,
  hook: null,
  content: null,
  status: "PLANNED",
  link: null,
})

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

function ContentCalendarSection({ projectId, canManage }: Props) {
  const thisYear = new Date().getFullYear()
  const [monthNum, setMonthNum] = useState("ALL") // "ALL" | "01".."12"
  const [year, setYear] = useState(String(thisYear))
  const [platform, setPlatform] = useState("")
  const month = monthNum === "ALL" ? "" : `${year}-${monthNum}`

  const { data, isLoading } = useContentCalendar(projectId, {
    month: month || undefined,
    platform: platform || undefined,
  })
  const create = useCreateEntry(projectId)
  const update = useUpdateEntry(projectId)
  const del = useDeleteEntry(projectId)
  const importXlsx = useImportCalendar(projectId)
  const importRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState<ContentEntry | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ContentEntry | null>(null)

  const rows = data?.data ?? []
  const posted = rows.filter((r) => r.status === "POSTED").length

  const columns: DataTableColumn<ContentEntry>[] = [
    { header: "Date", className: "whitespace-nowrap tabular-nums", cell: (r) => r.date ?? "-" },
    {
      header: "Platform",
      cell: (r) =>
        r.platform ? (
          <span className="bg-muted rounded px-1.5 py-0.5 text-xs font-medium">{r.platform}</span>
        ) : (
          "-"
        ),
    },
    { header: "Theme", cell: (r) => <span className="line-clamp-1">{r.theme ?? "-"}</span> },
    { header: "Format", cell: (r) => r.format ?? "-" },
    {
      header: "Hook",
      cell: (r) => (
        <span className="text-muted-foreground line-clamp-1 max-w-xs text-xs">{r.hook ?? "-"}</span>
      ),
    },
    {
      header: "Status",
      cell: (r) => (
        <StatusBadge
          status={r.status in CONTENT_CALENDAR_STATUS_LABELS ? r.status : "PLANNED"}
          colorMap={CONTENT_CALENDAR_STATUS_COLORS}
          labelMap={CONTENT_CALENDAR_STATUS_LABELS}
        />
      ),
    },
    {
      header: "",
      align: "right",
      cell: (r) =>
        canManage ? (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteTarget(r)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[11px]">Month</Label>
            <Select value={monthNum} onValueChange={setMonthNum}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All months</SelectItem>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1).padStart(2, "0")}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {monthNum !== "ALL" && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-[11px]">Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => thisYear - 2 + i).map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[11px]">Platform</Label>
            <Select
              value={platform || "ALL"}
              onValueChange={(v) => setPlatform(v === "ALL" ? "" : v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All platforms</SelectItem>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(monthNum !== "ALL" || platform) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setMonthNum("ALL")
                setPlatform("")
              }}
            >
              Clear
            </Button>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <input
              ref={importRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) importXlsx.mutate(file)
                e.target.value = ""
              }}
            />
            <Button variant="outline" size="sm" className="h-9 gap-1.5" asChild>
              <a href={`/api/projects/${projectId}/content-calendar/template`}>
                <FileDown className="h-4 w-4" /> Template
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              disabled={importXlsx.isPending}
              onClick={() => importRef.current?.click()}
            >
              {importXlsx.isPending ? <Spinner /> : <Upload className="h-4 w-4" />}
              Import xlsx
            </Button>
            <Button size="sm" className="h-9 gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Add post
            </Button>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <p className="text-muted-foreground text-xs">
          <span className="text-foreground font-semibold">{rows.length}</span> post
          {rows.length === 1 ? "" : "s"} ·{" "}
          <span className="text-foreground font-semibold">{posted}</span> posted
        </p>
      )}

      {isLoading ? (
        <ListSkeleton rows={6} height="h-12" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          variant="card"
          title="No content posts yet."
          description={
            canManage ? "Add a post, or import your content-calendar spreadsheet." : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          showSerial
          onRowClick={canManage ? (r) => setEditing(r) : undefined}
          minWidth="min-w-[880px]"
        />
      )}

      <EntryDialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false)
            setEditing(null)
          }
        }}
        initial={editing}
        pending={create.isPending || update.isPending}
        onSubmit={(body) => {
          if (editing)
            update.mutate({ id: editing.id, ...body }, { onSuccess: () => setEditing(null) })
          else create.mutate(body, { onSuccess: () => setCreating(false) })
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete post?"
        description="This content-calendar post will be permanently removed."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() =>
          deleteTarget && del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
        }
      />
    </div>
  )
}

function EntryDialog({
  open,
  onOpenChange,
  initial,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: ContentEntry | null
  pending: boolean
  onSubmit: (body: Omit<ContentEntry, "id">) => void
}) {
  const [form, setForm] = useState<Omit<ContentEntry, "id">>(emptyEntry())

  useEffect(() => {
    if (open) setForm(initial ? { ...initial } : emptyEntry())
  }, [open, initial])

  const set = (patch: Partial<Omit<ContentEntry, "id">>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit post" : "Add post"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-1 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <DateField
              value={form.date ?? ""}
              placeholder="Pick a date"
              onChange={(v) => set({ date: v || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select value={form.platform ?? undefined} onValueChange={(v) => set({ platform: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Theme / occasion</Label>
            <Input
              value={form.theme ?? ""}
              placeholder="e.g. Republic Day"
              onChange={(e) => set({ theme: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select value={form.format ?? undefined} onValueChange={(v) => set({ format: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_FORMATS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Hook</Label>
            <Textarea
              rows={2}
              placeholder="The scroll-stopping opening line…"
              value={form.hook ?? ""}
              onChange={(e) => set({ hook: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Content</Label>
            <Textarea
              rows={5}
              placeholder="Caption / slides / script…"
              value={form.content ?? ""}
              onChange={(e) => set({ content: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set({ status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CALENDAR_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {CONTENT_CALENDAR_STATUS_LABELS[s] ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Link</Label>
            <Input
              placeholder="https://…"
              value={form.link ?? ""}
              onChange={(e) => set({ link: e.target.value || null })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(form)} disabled={pending}>
            {pending ? "Saving…" : initial ? "Save changes" : "Add post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
