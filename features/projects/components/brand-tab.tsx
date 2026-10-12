"use client"

import { useEffect, useRef, useState } from "react"
import { Spinner } from "@/components/shared/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUrlState } from "@/hooks/use-url-state"
import { BrandAiDialog } from "./brand-ai-dialog"
import {
  ArrowLeft,
  ArrowRight,
  Check,
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
  ClipboardList,
  ImageIcon,
  Paperclip,
  Pencil,
  Sparkles,
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
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { DateField } from "@/components/shared/date-field"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { cn, formatDate, formatFileSize } from "@/lib/utils"
import {
  useProjectBrand,
  useSaveProjectBrand,
  useUploadBrandAsset,
  useDeleteBrandAsset,
} from "@/features/projects/hooks/use-brand"
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

/** The brand work in the order it is done; the step list numbers them the same way. */
const SECTIONS = [
  { value: "brief", label: "Brand Brief", icon: FileText },
  { value: "objectives", label: "Digital Objectives", icon: Target },
  { value: "manifestation", label: "Manifestation Plan", icon: Megaphone },
  { value: "overview", label: "Brand Overview", icon: ClipboardList },
  { value: "guidelines", label: "Brand Guidelines", icon: Palette },
] as const
type SectionKey = (typeof SECTIONS)[number]["value"]

/** The files each section holds (BrandAsset.kind). */
const SECTION_FILES: Record<SectionKey, BrandAssetKind> = {
  brief: "BRIEF",
  objectives: "OBJECTIVES",
  manifestation: "MANIFESTATION",
  overview: "OVERVIEW",
  guidelines: "LOGO",
}

const hasText = (v: string | null | undefined) => !!v?.trim()

export function BrandTab({ projectId, canManage }: Props) {
  return (
    <div className="mt-4">
      <StrategySection projectId={projectId} canManage={canManage} />
    </div>
  )
}

function SectionCard({
  icon: Icon,
  tint,
  step,
  title,
  description,
  canManage,
  editing,
  dirty,
  saving,
  onEdit,
  onCancel,
  onSave,
  children,
}: {
  icon: React.ElementType
  tint: string
  step: number
  title: string
  description: string
  canManage: boolean
  editing: boolean
  dirty: boolean
  saving: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  children: React.ReactNode
}) {
  return (
    <Card className={cn("overflow-hidden transition-shadow", editing && "ring-primary/30 ring-1")}>
      <CardHeader className="bg-muted/30 flex flex-row items-start justify-between gap-3 space-y-0 border-b py-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-sm", tint)}>
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
            {editing ? (
              <>
                {dirty && (
                  <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    Unsaved
                  </span>
                )}
                <Button variant="ghost" disabled={saving} onClick={onCancel}>
                  Cancel
                </Button>
                <Button className="gap-1.5" disabled={!dirty || saving} onClick={onSave}>
                  {saving ? <Spinner size="sm" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={onEdit}
                aria-label={`Edit ${title}`}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      {/* Its blocks (the files, then the written part) are split by a rule. */}
      <CardContent className="space-y-5 p-4 [&>*+*]:border-t [&>*+*]:pt-5">{children}</CardContent>
    </Card>
  )
}

/** A picker filter, not a security control; the server has the blocklist and size cap. */
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
  const [aiOpen, setAiOpen] = useState(false)
  // In the URL, so a reload or a shared link stays on the same section.
  const [sectionParam, setSection] = useUrlState("section", "brief")
  // Read-only until Edit: the tab is mostly read, and open text boxes invited stray edits.
  const [editing, setEditing] = useState<Partial<Record<SectionKey, boolean>>>({})

  const d = data?.data
  const origBrief = d?.brief ?? ""
  const origOverview = d?.overview ?? ""
  const origObjectives = Array.isArray(d?.objectives) ? d!.objectives : []
  const origManifestation = { ...emptyManifestation(), ...(d?.manifestation ?? {}) }
  const origGuidelines = { ...EMPTY_GUIDELINES, ...(d?.guidelines ?? {}) }

  // Seeded once: `d` is a new object on every refetch and would overwrite unsaved edits.
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

  // Filled = something saved or attached; dirty = edits not saved yet (drafts survive switching).
  const state: Record<SectionKey, { filled: boolean; dirty: boolean }> = {
    brief: {
      filled: hasText(origBrief) || filesFor("BRIEF").length > 0,
      dirty: brief !== origBrief,
    },
    objectives: {
      filled: origObjectives.length > 0 || filesFor("OBJECTIVES").length > 0,
      dirty: !same(objectives, origObjectives),
    },
    manifestation: {
      filled:
        Object.values(origManifestation).some((t) => hasText(t?.social) || hasText(t?.website)) ||
        filesFor("MANIFESTATION").length > 0,
      dirty: !same(manifestation, origManifestation),
    },
    overview: {
      filled: hasText(origOverview) || filesFor("OVERVIEW").length > 0,
      dirty: overview !== origOverview,
    },
    guidelines: {
      filled:
        origGuidelines.colors.length > 0 ||
        hasText(origGuidelines.fonts) ||
        hasText(origGuidelines.logoNotes) ||
        hasText(origGuidelines.uiux) ||
        filesFor("LOGO").length > 0,
      dirty: !same(guidelines, origGuidelines),
    },
  }
  const sectionIndex = Math.max(
    0,
    SECTIONS.findIndex((x) => x.value === sectionParam),
  )
  const section = SECTIONS[sectionIndex]!.value
  const prev = SECTIONS[sectionIndex - 1]
  const next = SECTIONS[sectionIndex + 1]
  const filledCount = SECTIONS.filter((x) => state[x.value].filled).length

  /** Which section is uploading, so only its button shows a spinner. */
  const uploadingKind = upload.isPending ? upload.variables?.kind : undefined

  const isEditing = (key: SectionKey) => canManage && !!editing[key]
  const setEditingKey = (key: SectionKey, on: boolean) => setEditing((e) => ({ ...e, [key]: on }))
  const fileCount = (key: SectionKey) => {
    const n = filesFor(SECTION_FILES[key]).length
    return n ? `${n} file${n === 1 ? "" : "s"}` : ""
  }

  /** Cancel throws away that section's edits. */
  function cancelEdit(key: SectionKey) {
    if (key === "brief") setBrief(origBrief)
    else if (key === "objectives") setObjectives(origObjectives)
    else if (key === "manifestation") setManifestation(origManifestation)
    else if (key === "overview") setOverview(origOverview)
    else setGuidelines(origGuidelines)
    setEditingKey(key, false)
  }

  function saveSection(key: SectionKey, payload: Partial<ProjectBrandData>) {
    setSavingKey(key)
    save.mutate(payload, {
      onSuccess: () => setEditingKey(key, false),
      onSettled: () => setSavingKey(null),
    })
  }

  /** The props every section card shares. */
  const cardProps = (key: SectionKey) => ({
    canManage,
    editing: isEditing(key),
    dirty: state[key].dirty,
    saving: savingKey === key,
    onEdit: () => setEditingKey(key, true),
    onCancel: () => cancelEdit(key),
  })

  if (isLoading) return <ListSkeleton rows={4} height="h-32" />

  const editObjectives = isEditing("objectives")
  const readCell = (v: string) => <span className="text-sm">{v || "-"}</span>
  const objectiveColumns: DataTableColumn<DigitalObjective>[] = [
    {
      header: "Platform",
      cell: (o) =>
        editObjectives ? (
          <Select
            value={o.platform || undefined}
            onValueChange={(v) => updateObj(setObjectives, o.id, { platform: v })}
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
        ) : (
          readCell(o.platform)
        ),
    },
    {
      header: "Metric",
      cell: (o) =>
        editObjectives ? (
          <Input
            className="h-9"
            placeholder="e.g. Followers"
            aria-label="Metric"
            value={o.metric}
            onChange={(e) => updateObj(setObjectives, o.id, { metric: e.target.value })}
          />
        ) : (
          readCell(o.metric)
        ),
    },
    {
      header: "Current",
      headClassName: "w-24",
      cell: (o) =>
        editObjectives ? (
          <Input
            className="h-9"
            placeholder="0"
            aria-label="Current"
            value={o.current}
            onChange={(e) => updateObj(setObjectives, o.id, { current: e.target.value })}
          />
        ) : (
          readCell(o.current)
        ),
    },
    {
      header: "Target",
      headClassName: "w-24",
      cell: (o) =>
        editObjectives ? (
          <Input
            className="h-9"
            placeholder="0"
            aria-label="Target"
            value={o.target}
            onChange={(e) => updateObj(setObjectives, o.id, { target: e.target.value })}
          />
        ) : (
          readCell(o.target)
        ),
    },
    {
      header: "Deadline",
      headClassName: "w-40",
      cell: (o) =>
        editObjectives ? (
          <DateField
            value={o.deadline}
            placeholder="Deadline"
            onChange={(v) => updateObj(setObjectives, o.id, { deadline: v })}
          />
        ) : (
          readCell(o.deadline ? formatDate(o.deadline) : "")
        ),
    },
    ...(editObjectives
      ? [
          {
            header: "",
            align: "right" as const,
            headClassName: "w-9",
            cell: (o: DigitalObjective) => (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove objective"
                title="Remove objective"
                onClick={() => setObjectives((p) => p.filter((x) => x.id !== o.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    // Drafts live here, not in the cards, so switching sections never discards an edit.
    // A numbered step list, not a second tab strip: under the page's own tabs that was easy to miss.
    <Tabs
      value={section}
      onValueChange={setSection}
      orientation="vertical"
      className="grid grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start"
    >
      {/* Measured from main's padded edge: 16px down already, so -4px leaves a 12px gap under the tabs. */}
      <nav
        aria-label="Brand sections"
        className="bg-card min-w-0 rounded-sm border p-1.5 lg:sticky lg:top-[calc(var(--project-tabs-h,0px)-0.25rem)]"
      >
        <p className="text-muted-foreground px-2 pt-1 pb-2 text-[10px] font-medium tracking-widest uppercase">
          Brand · {filledCount} of {SECTIONS.length} filled in
        </p>
        <TabsList className="h-auto w-full gap-1 bg-transparent p-0 lg:flex-col lg:items-stretch">
          {SECTIONS.map((x, i) => {
            const st = state[x.value]
            return (
              <TabsTrigger
                key={x.value}
                value={x.value}
                className="data-[state=active]:bg-muted data-[state=active]:text-foreground h-auto justify-start gap-2.5 px-2 py-1.5 text-left data-[state=active]:shadow-none lg:w-full"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums",
                    st.filled
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground",
                  )}
                >
                  {st.filled ? <Check className="size-3.5!" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{x.label}</span>
                    {st.dirty ? (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 lg:hidden"
                        aria-label="Unsaved changes"
                      />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "hidden text-[11px] font-normal lg:block",
                      st.dirty ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                    )}
                  >
                    {st.dirty
                      ? "Unsaved changes"
                      : [st.filled ? "Filled in" : "Not filled in yet", fileCount(x.value)]
                          .filter(Boolean)
                          .join(" · ")}
                  </span>
                </span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </nav>

      <div className="min-w-0 space-y-4">
        <TabsContent value="brief" className="mt-0">
          <SectionCard
            step={1}
            icon={FileText}
            tint="bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
            title="Brand Brief"
            description="The brief provided by the client."
            {...cardProps("brief")}
            onSave={() => saveSection("brief", { brief })}
          >
            <div className="space-y-3">
              <p className="text-sm font-semibold">Written brief</p>
              {isEditing("brief") ? (
                <>
                  <Textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    rows={8}
                    placeholder="Paste or write the client's brand brief…"
                    aria-label="Written brief"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-dashed p-3">
                    <p className="text-muted-foreground min-w-0 text-xs">
                      Let AI read the brief documents above and draft a detailed brand brief with
                      recommendations. Nothing is saved until you apply it and press Save.
                    </p>
                    <Button
                      variant="outline"
                      className="shrink-0 gap-1.5"
                      disabled={filesFor("BRIEF").length === 0}
                      title={
                        filesFor("BRIEF").length === 0 ? "Upload a brief document first" : undefined
                      }
                      onClick={() => setAiOpen(true)}
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Draft with AI
                    </Button>
                  </div>
                </>
              ) : (
                <ReadBox
                  value={brief}
                  empty={
                    canManage
                      ? "Nothing written yet. Click Edit to write or paste the brief."
                      : "Nothing written yet."
                  }
                />
              )}
            </div>
            <BrandAiDialog
              open={aiOpen}
              onOpenChange={setAiOpen}
              projectId={projectId}
              documents={filesFor("BRIEF")}
              hasCurrentBrief={brief.trim().length > 0}
              onApply={(text, mode) =>
                setBrief(mode === "append" && brief.trim() ? `${brief.trimEnd()}\n\n${text}` : text)
              }
            />
            <AssetRow
              label="Brief documents"
              files={filesFor("BRIEF")}
              canManage={canManage}
              uploading={uploadingKind === "BRIEF"}
              onUpload={(file) => upload.mutateAsync({ file, kind: "BRIEF" })}
              onDelete={(id) => delAsset.mutate(id)}
              accept={DOC_ACCEPT}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="objectives" className="mt-0">
          <SectionCard
            step={2}
            icon={Target}
            tint="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
            title="Digital Objectives"
            description="Targets per platform - followers, likes, reach…"
            {...cardProps("objectives")}
            onSave={() => saveSection("objectives", { objectives })}
          >
            <div className="space-y-3">
              <p className="text-sm font-semibold">Targets</p>
              {objectives.length === 0 ? (
                <EmptyState
                  icon={Target}
                  compact
                  title={
                    editObjectives
                      ? "No objectives yet - add your first target."
                      : "No objectives yet."
                  }
                />
              ) : (
                // Every row on one screen, no column picker, and a grid on phones too.
                <DataTable
                  columns={objectiveColumns}
                  rows={objectives}
                  rowKey={(o) => o.id}
                  showSerial
                  minWidth="min-w-[680px]"
                  pageSize={false}
                  columnToggle={false}
                  mobileCard={false}
                />
              )}
              {editObjectives && (
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() =>
                    setObjectives((p) => [
                      ...p,
                      {
                        id: uid(),
                        platform: "",
                        metric: "",
                        current: "",
                        target: "",
                        deadline: "",
                      },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Add objective
                </Button>
              )}
            </div>
            {/* Outside the Save flow: a file is stored the moment it is picked. */}
            <AssetRow
              label="Target sheets & reports"
              files={filesFor("OBJECTIVES")}
              canManage={canManage}
              uploading={uploadingKind === "OBJECTIVES"}
              onUpload={(file) => upload.mutateAsync({ file, kind: "OBJECTIVES" })}
              onDelete={(id) => delAsset.mutate(id)}
              accept={DOC_ACCEPT}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="manifestation" className="mt-0">
          <SectionCard
            step={3}
            icon={Megaphone}
            tint="bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
            title="Manifestation Plan"
            description="How each theme shows up on social media and the website."
            {...cardProps("manifestation")}
            onSave={() => saveSection("manifestation", { manifestation })}
          >
            <div className="space-y-3">
              <p className="text-sm font-semibold">Themes</p>
              <div className="grid gap-3 lg:grid-cols-2">
                {MANIFESTATION_THEMES.map((t) => (
                  <div
                    key={t.key}
                    className={cn("rounded-sm border border-l-4 p-3", THEME_ACCENT[t.key])}
                  >
                    <p className="text-sm font-semibold">{t.title}</p>
                    <p className="text-muted-foreground mb-2.5 text-xs">{t.hint}</p>
                    <div className="space-y-2">
                      {(
                        [
                          ["social", "Social media", "Themes, content pillars, post types…"],
                          ["website", "Website", "Pages, sections, campaigns…"],
                        ] as const
                      ).map(([field, label, hint]) => (
                        <div key={field}>
                          <Label className="text-muted-foreground text-[11px]">{label}</Label>
                          {isEditing("manifestation") ? (
                            <Textarea
                              rows={2}
                              className="bg-background mt-1"
                              placeholder={hint}
                              aria-label={`${t.title} - ${label}`}
                              value={manifestation[t.key]?.[field] ?? ""}
                              onChange={(e) =>
                                setManifestation((m) => ({
                                  ...m,
                                  [t.key]: {
                                    ...(m[t.key] ?? { social: "", website: "" }),
                                    [field]: e.target.value,
                                  },
                                }))
                              }
                            />
                          ) : (
                            <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-line">
                              {manifestation[t.key]?.[field]?.trim() || (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <AssetRow
              label="Plan documents"
              files={filesFor("MANIFESTATION")}
              canManage={canManage}
              uploading={uploadingKind === "MANIFESTATION"}
              onUpload={(file) => upload.mutateAsync({ file, kind: "MANIFESTATION" })}
              onDelete={(id) => delAsset.mutate(id)}
              accept={DOC_ACCEPT}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="overview" className="mt-0">
          <SectionCard
            step={4}
            icon={ClipboardList}
            tint="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
            title="Brand Overview"
            description="The strategy document built from the above + competitor & market research."
            {...cardProps("overview")}
            onSave={() => saveSection("overview", { overview })}
          >
            <div className="space-y-3">
              <p className="text-sm font-semibold">Written overview</p>
              {isEditing("overview") ? (
                <Textarea
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  rows={10}
                  placeholder="Positioning, competitor landscape, market research, key takeaways…"
                  aria-label="Written overview"
                />
              ) : (
                <ReadBox
                  value={overview}
                  empty={
                    canManage
                      ? "Nothing written yet. Click Edit to write the overview."
                      : "Nothing written yet."
                  }
                />
              )}
            </div>
            <AssetRow
              label="Strategy & research documents"
              files={filesFor("OVERVIEW")}
              canManage={canManage}
              uploading={uploadingKind === "OVERVIEW"}
              onUpload={(file) => upload.mutateAsync({ file, kind: "OVERVIEW" })}
              onDelete={(id) => delAsset.mutate(id)}
              accept={DOC_ACCEPT}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="guidelines" className="mt-0">
          <SectionCard
            step={5}
            icon={Palette}
            tint="bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
            title="Brand Guidelines"
            description="Logos, colors, fonts, UI/UX direction."
            {...cardProps("guidelines")}
            onSave={() => saveSection("guidelines", { guidelines })}
          >
            <GuidelinesBlock
              guidelines={guidelines}
              setGuidelines={setGuidelines}
              editing={isEditing("guidelines")}
            />
            <AssetRow
              label="Logos & guideline files"
              files={filesFor("LOGO")}
              canManage={canManage}
              uploading={uploadingKind === "LOGO"}
              onUpload={(file) => upload.mutateAsync({ file, kind: "LOGO" })}
              onDelete={(id) => delAsset.mutate(id)}
              accept="image/*,.pdf,.ai,.svg,.zip"
              icon={ImageIcon}
            />
          </SectionCard>
        </TabsContent>

        <div className="flex items-center justify-between gap-2">
          {prev ? (
            <Button variant="ghost" className="gap-1.5" onClick={() => setSection(prev.value)}>
              <ArrowLeft className="h-3.5 w-3.5" />
              {prev.label}
            </Button>
          ) : (
            <span />
          )}
          {next ? (
            <Button variant="outline" className="gap-1.5" onClick={() => setSection(next.value)}>
              Next: {next.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    </Tabs>
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

const FILE_KINDS: { test: RegExp; label: string; tint: string }[] = [
  {
    test: /\.pdf$|^application\/pdf$/i,
    label: "PDF",
    tint: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  {
    test: /\.(docx?|odt|rtf)$|wordprocessing|msword/i,
    label: "Document",
    tint: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  {
    test: /\.(xlsx?|csv|ods)$|spreadsheet|ms-excel|^text\/csv$/i,
    label: "Spreadsheet",
    tint: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    test: /\.(pptx?|odp|key)$|presentation|powerpoint/i,
    label: "Slides",
    tint: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  },
  {
    test: /\.(png|jpe?g|gif|webp|svg|avif)$|^image\//i,
    label: "Image",
    tint: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
]

function fileKind(fileName: string, mimeType: string): { label: string; tint: string } {
  return (
    FILE_KINDS.find((k) => k.test.test(fileName) || k.test.test(mimeType)) ?? {
      label: "File",
      tint: "bg-muted text-foreground/80",
    }
  )
}

/** Saved text, read-only: a bordered box rather than an idle text area. */
function ReadBox({ value, empty }: { value: string; empty: string }) {
  return (
    <div className="bg-muted/20 max-h-96 min-h-32 overflow-y-auto rounded-sm border px-4 py-3">
      {value.trim() ? (
        <p className="text-sm leading-relaxed break-words whitespace-pre-line">{value}</p>
      ) : (
        <p className="text-muted-foreground text-sm">{empty}</p>
      )}
    </div>
  )
}

const VALID_HEX = /^#[0-9a-f]{6}$/i

function GuidelinesBlock({
  guidelines,
  setGuidelines,
  editing,
}: {
  guidelines: BrandGuidelines
  setGuidelines: React.Dispatch<React.SetStateAction<BrandGuidelines>>
  editing: boolean
}) {
  const field = (
    key: "fonts" | "uiux" | "logoNotes",
    label: string,
    hint: string,
    long = false,
  ) => (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-[11px]">{label}</Label>
      {editing ? (
        long ? (
          <Textarea
            rows={2}
            value={guidelines[key]}
            placeholder={hint}
            aria-label={label}
            onChange={(e) => setGuidelines((g) => ({ ...g, [key]: e.target.value }))}
          />
        ) : (
          <Input
            value={guidelines[key]}
            placeholder={hint}
            aria-label={label}
            onChange={(e) => setGuidelines((g) => ({ ...g, [key]: e.target.value }))}
          />
        )
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-line">
          {guidelines[key].trim() || <span className="text-muted-foreground">-</span>}
        </p>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-muted-foreground text-[11px]">Colors</Label>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {guidelines.colors.length === 0 && !editing && (
            <span className="text-muted-foreground text-sm">-</span>
          )}
          {guidelines.colors.map((c, i) =>
            editing ? (
              <div
                key={i}
                className="bg-muted/30 group flex items-center gap-2 rounded-sm border px-2 py-1.5"
              >
                <input
                  type="color"
                  value={VALID_HEX.test(c.hex) ? c.hex : "#000000"}
                  onChange={(e) => updateColor(setGuidelines, i, { hex: e.target.value })}
                  className="h-7 w-7 cursor-pointer rounded-sm border-0 bg-transparent p-0"
                  aria-label={`Color ${i + 1}`}
                />
                <div className="flex flex-col">
                  <Input
                    className="h-6 w-24 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                    placeholder="Name"
                    aria-label="Color name"
                    value={c.name}
                    onChange={(e) => updateColor(setGuidelines, i, { name: e.target.value })}
                  />
                  <span className="text-muted-foreground px-1 font-mono text-[10px] uppercase">
                    {c.hex}
                  </span>
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove color"
                  onClick={() =>
                    setGuidelines((g) => ({ ...g, colors: g.colors.filter((_, j) => j !== i) }))
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div
                key={i}
                className="bg-muted/30 flex items-center gap-2 rounded-sm border px-2 py-1.5"
              >
                <span
                  className="h-7 w-7 shrink-0 rounded-sm border"
                  style={{ backgroundColor: VALID_HEX.test(c.hex) ? c.hex : undefined }}
                />
                <div className="flex flex-col">
                  <span className="px-1 text-xs font-medium">{c.name || "Unnamed"}</span>
                  <span className="text-muted-foreground px-1 font-mono text-[10px] uppercase">
                    {c.hex}
                  </span>
                </div>
              </div>
            ),
          )}
          {editing && (
            <Button
              variant="outline"
              className="gap-1.5 border-dashed px-3"
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
        {field("fonts", "Fonts", "e.g. Inter, Poppins")}
        {field("uiux", "UI / UX direction", "Tone, layout, imagery style…")}
      </div>
      {field("logoNotes", "Logo notes", "Logo usage, clear space, do's & don'ts…", true)}
    </div>
  )
}

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
  /** Called once per file, in order; return the promise so the next file waits. */
  onUpload: (file: File) => Promise<unknown> | void
  onDelete: (id: string) => void
  accept?: string
  icon?: React.ElementType
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  async function onPicked(picked: File[]) {
    for (const file of picked) {
      try {
        await onUpload(file)
      } catch {
        // The upload hook already toasted the reason; carry on with the rest.
      }
    }
  }
  // Nothing to show an employee when there are no files; managers get the upload card.
  if (!canManage && files.length === 0) return null
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Paperclip className="text-muted-foreground h-4 w-4" />
        {label}
        {files.length > 0 && (
          <span className="bg-muted text-muted-foreground rounded-sm px-1.5 text-xs font-medium tabular-nums">
            {files.length}
          </span>
        )}
      </p>
      {/* Cards, not full-width rows: several files sit side by side and each reads as a thing to open. */}
      <div className="grid [grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {files.map((f) => {
          const kind = fileKind(f.fileName, f.mimeType)
          return (
            <div
              key={f.id}
              className="bg-card hover:border-foreground/25 flex flex-col gap-3 rounded-sm border p-3 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm",
                    kind.tint,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium wrap-anywhere" title={f.fileName}>
                    {f.fileName}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {kind.label}
                    {f.fileSize > 0 && ` · ${formatFileSize(f.fileSize)}`}
                  </p>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-1 h-7 w-7 shrink-0"
                    onClick={() => onDelete(f.id)}
                    aria-label={`Delete ${f.fileName}`}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="mt-auto flex items-center gap-1.5">
                <Button asChild variant="outline" className="h-8 flex-1 gap-1.5 px-2 text-xs">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`View ${f.fileName}`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </a>
                </Button>
                {/* The signed URL carries content-disposition, so it downloads even cross-origin. */}
                <Button asChild variant="outline" className="h-8 flex-1 gap-1.5 px-2 text-xs">
                  <a
                    href={f.downloadUrl ?? f.url}
                    download={f.fileName}
                    aria-label={`Download ${f.fileName}`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </Button>
              </div>
            </div>
          )
        })}
        {canManage && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={accept}
              className="hidden"
              onChange={(e) => {
                // Copy BEFORE resetting: clearing the input empties its FileList.
                const picked = Array.from(e.target.files ?? [])
                // Reset so the picker re-fires for the same selection next time.
                e.target.value = ""
                if (picked.length) void onPicked(picked)
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="text-muted-foreground hover:text-foreground hover:border-foreground/40 focus-visible:ring-ring flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-sm border border-dashed p-3 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
            >
              {uploading ? <Spinner size="sm" /> : <Upload className="h-4 w-4" />}
              <span className="font-medium">{uploading ? "Uploading…" : "Upload files"}</span>
              {files.length === 0 && !uploading && <span>No files yet</span>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
