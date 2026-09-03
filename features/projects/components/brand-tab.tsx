"use client"

import { useEffect, useRef, useState } from "react"
import { Spinner } from "@/components/shared/spinner"
// Concrete module, not the feature barrel: brand-tab is itself lazily loaded,
// and a barrel import would drag the whole feature into its chunk.
import { ProjectSheetSection } from "./project-sheet"
import {
  Save,
  Plus,
  Trash2,
  Upload,
  Download,
  Eye,
  FileText,
  Target,
  Megaphone,
  Palette,
  Sparkles,
  ClipboardList,
  CalendarDays,
  Table2,
  Pencil,
  ImageIcon,
  FileDown,
  CheckSquare,
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
import { cn } from "@/lib/utils"
import {
  useProjectBrand,
  useSaveProjectBrand,
  useUploadBrandAsset,
  useDeleteBrandAsset,
} from "@/features/projects/hooks/use-brand"
import { useAssignableEmployees } from "@/features/projects/hooks/use-projects"
import {
  PLATFORMS,
  MANIFESTATION_THEMES,
  EMPTY_GUIDELINES,
  emptyManifestation,
  type BrandAssetKind,
  type DigitalObjective,
  type BrandGuidelines,
  type Manifestation,
  type ProjectBrandData,
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
          <Table2 className="h-3.5 w-3.5" /> Content Calendar
        </TabsTrigger>
      </TabsList>
      <TabsContent value="strategy">
        <StrategySection projectId={projectId} canManage={canManage} />
      </TabsContent>
      <TabsContent value="calendar">
        {/* The calendar is a SHEET now, not a form. Its columns belong to the
            team rather than to this file - see project-sheet.tsx. */}
        <ProjectSheetSection projectId={projectId} canManage={canManage} />
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

/**
 * What the file picker offers on the document sections.
 *
 * Spreadsheets are in the list because the two sections that grew uploads last -
 * objectives and the manifestation plan - are the ones people already keep in
 * Excel. `accept` is a filter on the picker, not a security control; the server
 * has the blocklist and the size cap.
 */
const DOC_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,image/*"

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

  // Seeded ONCE. `d` is a new object identity on every refetch, so this used
  // to re-run on each one and overwrite whatever the user had typed but not yet
  // saved. After the first load the local fields are the source of truth until
  // they save or discard.
  const seededRef = useRef(false)
  useEffect(() => {
    if (!d || seededRef.current) return
    seededRef.current = true
    setBrief(d.brief ?? "")
    setOverview(d.overview ?? "")
    setObjectives(Array.isArray(d.objectives) ? d.objectives : [])
    setManifestation({ ...emptyManifestation(), ...(d.manifestation ?? {}) })
    setGuidelines({ ...EMPTY_GUIDELINES, ...(d.guidelines ?? {}) })
  }, [d])

  const assets = d?.assets ?? []
  const filesFor = (kind: BrandAssetKind) => assets.filter((a) => a.kind === kind)

  /**
   * Which section is mid-upload.
   *
   * Read off the mutation's own variables rather than a bare `upload.isPending`:
   * one shared flag put a spinner on all five upload buttons at once, so a file
   * going into Brand Brief looked like it was going into everything.
   */
  const uploadingKind = upload.isPending ? upload.variables?.kind : undefined

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
          aria-label="e.g. Followers"
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
          aria-label="0"
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
          aria-label="0"
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
          aria-label="Paste or write the client's brand brief"
        />
        <AssetRow
          label="Brief documents"
          files={filesFor("BRIEF")}
          canManage={canManage}
          uploading={uploadingKind === "BRIEF"}
          onUpload={(file) => upload.mutate({ file, kind: "BRIEF" })}
          onDelete={(id) => delAsset.mutate(id)}
          accept={DOC_ACCEPT}
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
        {/* Outside the Save flow, like every other AssetRow: a file is stored the
            moment it is picked, so attaching the client's target sheet does not
            depend on remembering to press Save on the table above it. */}
        <AssetRow
          label="Target sheets & reports"
          files={filesFor("OBJECTIVES")}
          canManage={canManage}
          uploading={uploadingKind === "OBJECTIVES"}
          onUpload={(file) => upload.mutate({ file, kind: "OBJECTIVES" })}
          onDelete={(id) => delAsset.mutate(id)}
          accept={DOC_ACCEPT}
        />
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
            <div
              key={t.key}
              className={cn("rounded-[2px] border border-l-4 p-3", THEME_ACCENT[t.key])}
            >
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
                    aria-label="Themes, content pillars, post types"
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
                    aria-label="Pages, sections, campaigns"
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
        {/* Section-level, not per-theme. Four upload rows inside a four-card grid
            would read as part of each theme's form; the plan is presented as one
            document, so its attachments hang off the whole plan. */}
        <AssetRow
          label="Plan documents"
          files={filesFor("MANIFESTATION")}
          canManage={canManage}
          uploading={uploadingKind === "MANIFESTATION"}
          onUpload={(file) => upload.mutate({ file, kind: "MANIFESTATION" })}
          onDelete={(id) => delAsset.mutate(id)}
          accept={DOC_ACCEPT}
        />
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
          aria-label="Positioning, competitor landscape, market research, key takeaways"
        />
        <AssetRow
          label="Strategy & research documents"
          files={filesFor("OVERVIEW")}
          canManage={canManage}
          uploading={uploadingKind === "OVERVIEW"}
          onUpload={(file) => upload.mutate({ file, kind: "OVERVIEW" })}
          onDelete={(id) => delAsset.mutate(id)}
          accept={DOC_ACCEPT}
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
                  className="bg-muted/30 group flex items-center gap-2 rounded-[2px] border px-2 py-1.5"
                >
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#000000"}
                    disabled={!canManage}
                    onChange={(e) => updateColor(setGuidelines, i, { hex: e.target.value })}
                    className="h-7 w-7 cursor-pointer rounded-[2px] border-0 bg-transparent p-0"
                  />
                  <div className="flex flex-col">
                    <Input
                      className="h-6 w-24 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                      placeholder="Name"
                      aria-label="Name"
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
                  className="h-11.5 gap-1.5 border-dashed"
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
                aria-label="e.g. Inter, Poppins"
                onChange={(e) => setGuidelines((g) => ({ ...g, fonts: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">UI / UX direction</Label>
              <Input
                value={guidelines.uiux}
                disabled={!canManage}
                placeholder="Tone, layout, imagery style…"
                aria-label="Tone, layout, imagery style"
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
              aria-label="Logo usage, clear space, do's & don'ts"
              onChange={(e) => setGuidelines((g) => ({ ...g, logoNotes: e.target.value }))}
            />
          </div>

          <AssetRow
            label="Logos & guideline files"
            files={filesFor("LOGO")}
            canManage={canManage}
            uploading={uploadingKind === "LOGO"}
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
      <div className="space-y-1.5">
        {files.map((f) => (
          <div
            key={f.id}
            className="bg-muted/40 flex items-center gap-2 rounded-[2px] border px-2.5 py-1.5 text-xs"
          >
            <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
            {/* Full file name - breaks across lines instead of truncating. */}
            <span className="min-w-0 flex-1 font-medium break-all" title={f.fileName}>
              {f.fileName}
            </span>
            <div className="flex shrink-0 items-center gap-0.5">
              {/* View: opens inline in a new tab. */}
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                title="View"
                className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-7 w-7 items-center justify-center rounded"
              >
                <Eye className="h-3.5 w-3.5" />
              </a>
              {/* Download: saves the file under its real name (signed URL carries a
                  content-disposition header, so it downloads even cross-origin). */}
              <a
                href={f.downloadUrl ?? f.url}
                download={f.fileName}
                title="Download"
                className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-7 w-7 items-center justify-center rounded"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              {/* Delete: always visible (was hidden until hover). Gated on canManage,
                  which is admin OR the project's account manager - see the project page. */}
              {canManage && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex h-7 w-7 items-center justify-center rounded"
                  onClick={() => onDelete(f.id)}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
        {files.length === 0 && !canManage && (
          <span className="text-muted-foreground text-xs">No files.</span>
        )}
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
              className="h-8 w-full gap-1.5 border-dashed"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Spinner size="sm" /> : <Upload className="h-3.5 w-3.5" />}
              Upload file
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
