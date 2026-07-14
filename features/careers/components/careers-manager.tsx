"use client"

import { useState } from "react"
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react"
import { Spinner } from "@/components/shared/spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { FormDialog } from "@/components/shared/form-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"
import {
  useCareersTree,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useCreateSubDepartment,
  useUpdateSubDepartment,
  useDeleteSubDepartment,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useCreateOpening,
  useDeleteOpening,
} from "@/features/careers/hooks/use-careers"
import type {
  AdminCareerGroup,
  AdminCareerRole,
  AdminCareerSubDepartment,
  CareerDbMode,
} from "@/features/careers/careers.types"

type CareerRowStatus = "DRAFT" | "PUBLISHED"

// Calm status dot (a badge at every level was too noisy).
function StatusDot({ status }: { status: CareerRowStatus }) {
  const live = status === "PUBLISHED"
  return (
    <span
      aria-label={live ? "Published" : "Draft"}
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        live ? "bg-primary" : "bg-muted-foreground/40",
      )}
    />
  )
}

// A large navigational tile (matches the public careers cards' layout) styled
// with the APP THEME (card surface, primary accent), plus admin controls
// (publish toggle + ⋮ menu). Click the tile to drill in.
function CareerTile({
  code,
  title,
  footer,
  status,
  onOpen,
  onEdit,
  onDelete,
  onToggle,
  pending,
}: {
  code?: string
  title: string
  footer: string
  status: CareerRowStatus
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  onToggle: (next: CareerRowStatus) => void
  pending?: boolean
}) {
  const live = status === "PUBLISHED"
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        "bg-card hover:border-primary/40 focus-visible:ring-ring relative flex min-h-[190px] cursor-pointer flex-col rounded-lg border p-6 shadow-sm transition-all hover:shadow-md focus:outline-none focus-visible:ring-2",
        !live && "opacity-95",
      )}
    >
      <div className="absolute top-3 right-3" onClick={stop}>
        <RowActions onEdit={onEdit} onDelete={onDelete} />
      </div>

      {code && (
        <span className="text-primary text-xs font-bold tracking-widest uppercase">{code}</span>
      )}
      <h3 className="text-foreground mt-2 max-w-[88%] text-2xl leading-tight font-bold">{title}</h3>

      <div className="mt-auto flex items-end justify-between gap-2 pt-6">
        <div className="min-w-0">
          {!live && (
            <span className="bg-muted text-muted-foreground mb-1.5 inline-block rounded-lg px-1.5 py-0.5 text-[10px] font-medium">
              Draft - hidden from site
            </span>
          )}
          <p className="text-muted-foreground text-sm">{footer}</p>
        </div>
        <div onClick={stop} className="shrink-0">
          <PublishToggle status={status} disabled={pending} onChange={onToggle} />
        </div>
      </div>
    </div>
  )
}

// Inline publish/unpublish switch with a clear Live/Draft label.
function PublishToggle({
  status,
  onChange,
  disabled,
}: {
  status: CareerRowStatus
  onChange: (next: CareerRowStatus) => void
  disabled?: boolean
}) {
  const live = status === "PUBLISHED"
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <Switch
              checked={live}
              disabled={disabled}
              onCheckedChange={(c) => onChange(c ? "PUBLISHED" : "DRAFT")}
            />
            <span className={cn("w-9 text-xs", live ? "text-foreground" : "text-muted-foreground")}>
              {live ? "Live" : "Draft"}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {live ? "Published - visible on the site" : "Draft - hidden from the site"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Edit / Delete tucked into a compact overflow menu to keep rows tidy.
// Dialog opening is deferred to the next tick so the menu's focus/pointer
// cleanup finishes first (avoids the Radix "pointer-events stuck" race).
function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const defer = (fn: () => void) => () => setTimeout(fn, 0)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Actions">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={defer(onEdit)}>
          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={defer(onDelete)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ToneStatusFields({
  tone,
  setTone,
  status,
  setStatus,
  order,
  setOrder,
}: {
  tone: string
  setTone: (v: string) => void
  status: string
  setStatus: (v: string) => void
  order: string
  setOrder: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <Label>Tone</Label>
        <Select value={tone} onValueChange={setTone}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="teal">Teal</SelectItem>
            <SelectItem value="red">Red</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Order</Label>
        <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
      </div>
    </div>
  )
}

// ─── Group dialog ──────────────────────────────────────────────────────────────
function GroupDialog({
  open,
  onOpenChange,
  group,
  mode,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  group?: AdminCareerGroup
  mode: CareerDbMode
}) {
  const isEdit = !!group
  const create = useCreateGroup()
  const update = useUpdateGroup()
  const [code, setCode] = useState(group?.code ?? "")
  const [title, setTitle] = useState(group?.title ?? "")
  const [slug, setSlug] = useState(group?.slug ?? "")
  const [jobsLabel, setJobsLabel] = useState(group?.jobsLabel ?? "Explore Sub-Departments")
  const [tone, setTone] = useState<string>(group?.tone ?? "teal")
  const [status, setStatus] = useState<string>(group?.status ?? "DRAFT")
  const [order, setOrder] = useState(String(group?.order ?? 0))

  const pending = create.isPending || update.isPending

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const body = {
      code,
      title,
      slug: slug || undefined,
      jobsLabel,
      tone,
      status,
      order: Number(order) || 0,
    }
    const onSuccess = () => onOpenChange(false)
    if (isEdit) update.mutate({ id: group.id, body }, { onSuccess })
    else create.mutate({ ...body, mode }, { onSuccess })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit group" : "New group"}
      isEdit={isEdit}
      isPending={pending}
      onSubmit={submit}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Code</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SMG"
            required
          />
        </div>
        <div>
          <Label>Slug (optional)</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto from title"
          />
        </div>
      </div>
      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <Label>Jobs label</Label>
        <Input value={jobsLabel} onChange={(e) => setJobsLabel(e.target.value)} required />
      </div>
      <ToneStatusFields
        tone={tone}
        setTone={setTone}
        status={status}
        setStatus={setStatus}
        order={order}
        setOrder={setOrder}
      />
    </FormDialog>
  )
}

// ─── Sub-department dialog ───────────────────────────────────────────────────
function SubDeptDialog({
  open,
  onOpenChange,
  groupId,
  sub,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  groupId: string
  sub?: AdminCareerSubDepartment
}) {
  const isEdit = !!sub
  const create = useCreateSubDepartment()
  const update = useUpdateSubDepartment()
  const [title, setTitle] = useState(sub?.title ?? "")
  const [slug, setSlug] = useState(sub?.slug ?? "")
  const [jobsLabel, setJobsLabel] = useState(sub?.jobsLabel ?? "Explore Open Roles")
  const [tone, setTone] = useState<string>(sub?.tone ?? "teal")
  const [status, setStatus] = useState<string>(sub?.status ?? "DRAFT")
  const [order, setOrder] = useState(String(sub?.order ?? 0))
  const pending = create.isPending || update.isPending

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const body = {
      title,
      slug: slug || undefined,
      jobsLabel,
      tone,
      status,
      order: Number(order) || 0,
    }
    const onSuccess = () => onOpenChange(false)
    if (isEdit) update.mutate({ id: sub.id, body }, { onSuccess })
    else create.mutate({ ...body, groupId }, { onSuccess })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit sub-department" : "New sub-department"}
      isEdit={isEdit}
      isPending={pending}
      onSubmit={submit}
    >
      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <Label>Slug (optional)</Label>
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="auto from title"
        />
      </div>
      <div>
        <Label>Jobs label</Label>
        <Input value={jobsLabel} onChange={(e) => setJobsLabel(e.target.value)} required />
      </div>
      <ToneStatusFields
        tone={tone}
        setTone={setTone}
        status={status}
        setStatus={setStatus}
        order={order}
        setOrder={setOrder}
      />
    </FormDialog>
  )
}

// ─── Role dialog (content + openings) ────────────────────────────────────────
function RoleDialog({
  open,
  onOpenChange,
  subDepartmentId,
  role,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  subDepartmentId: string
  role?: AdminCareerRole
}) {
  const isEdit = !!role
  const create = useCreateRole()
  const update = useUpdateRole()
  const addOpening = useCreateOpening()
  const removeOpening = useDeleteOpening()

  const [title, setTitle] = useState(role?.title ?? "")
  const [slug, setSlug] = useState(role?.slug ?? "")
  const [status, setStatus] = useState<string>(role?.status ?? "DRAFT")
  const [order, setOrder] = useState(String(role?.order ?? 0))
  const [intro, setIntro] = useState(role?.intro ?? "")
  const [jobEssence, setJobEssence] = useState(role?.jobEssence ?? "")
  const [keyReq, setKeyReq] = useState((role?.keyRequirements ?? []).join("\n"))
  const [newOpening, setNewOpening] = useState("")
  const pending = create.isPending || update.isPending

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const body = {
      title,
      slug: slug || undefined,
      status,
      order: Number(order) || 0,
      intro: intro.trim() || null,
      jobEssence: jobEssence.trim() || null,
      keyRequirements: keyReq
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    }
    const onSuccess = () => onOpenChange(false)
    if (isEdit) update.mutate({ id: role.id, body }, { onSuccess })
    else create.mutate({ ...body, subDepartmentId }, { onSuccess })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit role" : "New role"}
      isEdit={isEdit}
      isPending={pending}
      onSubmit={submit}
      contentClassName="sm:max-w-2xl"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label>Slug (optional)</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto from title"
          />
        </div>
      </div>
      <div>
        <Label>Intro</Label>
        <Textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} />
      </div>
      <div>
        <Label>Job essence</Label>
        <Textarea rows={3} value={jobEssence} onChange={(e) => setJobEssence(e.target.value)} />
      </div>
      <div>
        <Label>Key requirements (one per line)</Label>
        <Textarea rows={4} value={keyReq} onChange={(e) => setKeyReq(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Order</Label>
          <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
        </div>
      </div>

      {isEdit && (
        <div className="rounded-lg border p-3">
          <Label className="mb-2 block">Current openings</Label>
          <div className="space-y-1.5">
            {(role.openings ?? []).map((op) => (
              <div key={op.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{op.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => removeOpening.mutate(op.id)}
                  disabled={removeOpening.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {(role.openings ?? []).length === 0 && (
              <p className="text-muted-foreground text-xs">No openings yet.</p>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={newOpening}
              onChange={(e) => setNewOpening(e.target.value)}
              placeholder="e.g. Junior SEO Executive (1-2 Years Exp)"
              className="h-8"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!newOpening.trim() || addOpening.isPending}
              onClick={() =>
                addOpening.mutate(
                  {
                    roleId: role.id,
                    label: newOpening.trim(),
                    order: role.openings?.length ?? 0,
                    status: "PUBLISHED",
                  },
                  { onSuccess: () => setNewOpening("") },
                )
              }
            >
              Add
            </Button>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Openings save immediately. Re-open this dialog to see the latest list.
          </p>
        </div>
      )}
    </FormDialog>
  )
}

// ─── Role card ───────────────────────────────────────────────────────────────
function RoleItem({ role, subId }: { role: AdminCareerRole; subId: string }) {
  const [edit, setEdit] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const del = useDeleteRole()
  const update = useUpdateRole()
  const openings = role.openings ?? []
  return (
    <div className="bg-card flex flex-col rounded-lg border p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setEdit(true)}
          title="Edit role"
        >
          <StatusDot status={role.status} />
          <span className="truncate text-sm font-semibold hover:underline">{role.title}</span>
        </button>
        <RowActions onEdit={() => setEdit(true)} onDelete={() => setConfirm(true)} />
      </div>

      {openings.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {openings.map((op) => (
            <span
              key={op.id}
              className="bg-muted text-muted-foreground rounded-lg px-1.5 py-0.5 text-[11px]"
            >
              {op.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground mt-2 text-xs italic">No openings listed</p>
      )}

      <div className="mt-3 flex items-center justify-between border-t pt-2">
        <span className="text-muted-foreground text-xs">
          {openings.length} opening{openings.length === 1 ? "" : "s"}
        </span>
        <PublishToggle
          status={role.status}
          disabled={update.isPending}
          onChange={(status) => update.mutate({ id: role.id, body: { status } })}
        />
      </div>

      {edit && (
        <RoleDialog open={edit} onOpenChange={setEdit} subDepartmentId={subId} role={role} />
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete role "${role.title}"?`}
        description="This removes the role and all its openings. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => del.mutate(role.id)}
      />
    </div>
  )
}

// ─── Group tile (drills into its sub-departments) ────────────────────────────
function GroupTile({ group, onOpen }: { group: AdminCareerGroup; onOpen: () => void }) {
  const [edit, setEdit] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const del = useDeleteGroup()
  const update = useUpdateGroup()
  const n = group.subDepartments.length
  return (
    <>
      <CareerTile
        code={group.code}
        title={group.title}
        status={group.status}
        footer={`${group.jobsLabel} · ${n} department${n === 1 ? "" : "s"}`}
        onOpen={onOpen}
        onEdit={() => setEdit(true)}
        onDelete={() => setConfirm(true)}
        onToggle={(status) => update.mutate({ id: group.id, body: { status } })}
        pending={update.isPending}
      />
      {edit && <GroupDialog open={edit} onOpenChange={setEdit} group={group} mode={group.mode} />}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete group "${group.title}"?`}
        description="This removes the group and everything under it. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => del.mutate(group.id)}
      />
    </>
  )
}

// ─── Sub-department tile (drills into its roles) ─────────────────────────────
function SubDeptTile({ sub, onOpen }: { sub: AdminCareerSubDepartment; onOpen: () => void }) {
  const [edit, setEdit] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const del = useDeleteSubDepartment()
  const update = useUpdateSubDepartment()
  const n = sub.roles.length
  return (
    <>
      <CareerTile
        title={sub.title}
        status={sub.status}
        footer={`${sub.jobsLabel} · ${n} role${n === 1 ? "" : "s"}`}
        onOpen={onOpen}
        onEdit={() => setEdit(true)}
        onDelete={() => setConfirm(true)}
        onToggle={(status) => update.mutate({ id: sub.id, body: { status } })}
        pending={update.isPending}
      />
      {edit && <SubDeptDialog open={edit} onOpenChange={setEdit} groupId={sub.id} sub={sub} />}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete "${sub.title}"?`}
        description="This removes the sub-department, its roles and openings. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => del.mutate(sub.id)}
      />
    </>
  )
}

// ─── Mode panel (drill-down: groups → sub-departments → roles) ───────────────
function ModePanel({ groups, mode }: { groups: AdminCareerGroup[]; mode: CareerDbMode }) {
  const [groupId, setGroupId] = useState<string | null>(null)
  const [subId, setSubId] = useState<string | null>(null)
  const [addGroup, setAddGroup] = useState(false)
  const [addSub, setAddSub] = useState(false)
  const [addRole, setAddRole] = useState(false)

  const group = groups.find((g) => g.id === groupId) ?? null
  const sub = group?.subDepartments.find((s) => s.id === subId) ?? null

  const crumb = (label: string, active: boolean, onClick?: () => void) =>
    onClick ? (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "max-w-[16rem] truncate hover:underline",
          active ? "text-foreground font-semibold" : "text-muted-foreground",
        )}
      >
        {label}
      </button>
    ) : (
      <span className="text-foreground max-w-[16rem] truncate font-semibold">{label}</span>
    )

  const sep = <span className="text-muted-foreground/60">/</span>

  const breadcrumb = (
    <nav className="flex items-center gap-1.5 text-sm">
      {crumb("All groups", !group, () => {
        setGroupId(null)
        setSubId(null)
      })}
      {group && sep}
      {group && crumb(group.title, !sub, sub ? () => setSubId(null) : undefined)}
      {sub && sep}
      {sub && crumb(sub.title, true)}
    </nav>
  )

  // ── Roles view ──
  if (group && sub) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {breadcrumb}
          <Button size="sm" onClick={() => setAddRole(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add role
          </Button>
        </div>
        {sub.roles.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sub.roles.map((r) => (
              <RoleItem key={r.id} role={r} subId={sub.id} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No roles yet"
            description="Add the first role to this sub-department."
          />
        )}
        {addRole && (
          <RoleDialog open={addRole} onOpenChange={setAddRole} subDepartmentId={sub.id} />
        )}
      </div>
    )
  }

  // ── Sub-departments view ──
  if (group) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {breadcrumb}
          <Button size="sm" onClick={() => setAddSub(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add sub-department
          </Button>
        </div>
        {group.subDepartments.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.subDepartments.map((s) => (
              <SubDeptTile key={s.id} sub={s} onOpen={() => setSubId(s.id)} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No sub-departments yet"
            description="Add the first sub-department to this group."
          />
        )}
        {addSub && <SubDeptDialog open={addSub} onOpenChange={setAddSub} groupId={group.id} />}
      </div>
    )
  }

  // ── Groups view ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {breadcrumb}
        <Button size="sm" onClick={() => setAddGroup(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add group
        </Button>
      </div>
      {groups.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <GroupTile key={g.id} group={g} onOpen={() => setGroupId(g.id)} />
          ))}
        </div>
      ) : (
        <EmptyState title="No groups" description="Create the first group for this mode." />
      )}
      {addGroup && <GroupDialog open={addGroup} onOpenChange={setAddGroup} mode={mode} />}
    </div>
  )
}

export function CareersManager() {
  const { data, isLoading } = useCareersTree()
  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner size="lg" className="text-muted-foreground" />
      </div>
    )
  }
  const groups = data ?? []
  const fullTime = groups.filter((g) => g.mode === "FULL_TIME")
  const internship = groups.filter((g) => g.mode === "INTERNSHIP")

  return (
    <div className="space-y-4">
      <PageHeader
        title="Careers"
        description="Manage the careers tree shown on the public site. Only PUBLISHED items are served."
      />
      <Tabs defaultValue="full-time">
        <TabsList>
          <TabsTrigger value="full-time">Full-time ({fullTime.length})</TabsTrigger>
          <TabsTrigger value="internship">Internships ({internship.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="full-time" className="mt-4">
          <ModePanel groups={fullTime} mode="FULL_TIME" />
        </TabsContent>
        <TabsContent value="internship" className="mt-4">
          <ModePanel groups={internship} mode="INTERNSHIP" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
