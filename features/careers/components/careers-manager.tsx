"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import { FormDialog } from "@/components/shared/form-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
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

function StatusBadge({ status }: { status: "DRAFT" | "PUBLISHED" }) {
  return (
    <Badge variant={status === "PUBLISHED" ? "default" : "secondary"} className="text-[10px]">
      {status}
    </Badge>
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
        <div className="rounded-md border p-3">
          <Label className="mb-2 block">Current openings</Label>
          <div className="space-y-1.5">
            {(role.openings ?? []).map((op) => (
              <div key={op.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{op.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
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

// ─── Role row ──────────────────────────────────────────────────────────────────
function RoleItem({ role, subId }: { role: AdminCareerRole; subId: string }) {
  const [edit, setEdit] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const del = useDeleteRole()
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium">{role.title}</span>
        <StatusBadge status={role.status} />
        {role.openings?.length > 0 && (
          <span className="text-muted-foreground text-xs">{role.openings.length} openings</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEdit(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirm(true)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
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

// ─── Sub-department block ────────────────────────────────────────────────────
function SubDeptBlock({ sub }: { sub: AdminCareerSubDepartment }) {
  const [edit, setEdit] = useState(false)
  const [addRole, setAddRole] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const del = useDeleteSubDepartment()
  return (
    <div className="rounded-md border border-dashed p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">{sub.title}</span>
          <StatusBadge status={sub.status} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="sm" className="h-7" onClick={() => setAddRole(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Role
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEdit(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirm(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        {sub.roles.map((r) => (
          <RoleItem key={r.id} role={r} subId={sub.id} />
        ))}
        {sub.roles.length === 0 && <p className="text-muted-foreground text-xs">No roles yet.</p>}
      </div>
      {edit && <SubDeptDialog open={edit} onOpenChange={setEdit} groupId={sub.id} sub={sub} />}
      {addRole && <RoleDialog open={addRole} onOpenChange={setAddRole} subDepartmentId={sub.id} />}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete "${sub.title}"?`}
        description="This removes the sub-department, its roles and openings. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => del.mutate(sub.id)}
      />
    </div>
  )
}

// ─── Group card ──────────────────────────────────────────────────────────────
function GroupCard({ group }: { group: AdminCareerGroup }) {
  const [openBody, setOpenBody] = useState(true)
  const [edit, setEdit] = useState(false)
  const [addSub, setAddSub] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const del = useDeleteGroup()
  const update = useUpdateGroup()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 py-3">
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 text-left"
          onClick={() => setOpenBody((v) => !v)}
        >
          {openBody ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate font-semibold">{group.title}</span>
          <Badge variant="outline" className="text-[10px]">
            {group.code}
          </Badge>
          <StatusBadge status={group.status} />
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Switch
              checked={group.status === "PUBLISHED"}
              onCheckedChange={(c) =>
                update.mutate({ id: group.id, body: { status: c ? "PUBLISHED" : "DRAFT" } })
              }
            />
            <span className="text-muted-foreground text-xs">Published</span>
          </div>
          <Button variant="outline" size="sm" className="h-7" onClick={() => setAddSub(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Sub-dept
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEdit(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirm(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      {openBody && (
        <CardContent className="space-y-2">
          {group.subDepartments.map((s) => (
            <SubDeptBlock key={s.id} sub={s} />
          ))}
          {group.subDepartments.length === 0 && (
            <p className="text-muted-foreground text-sm">No sub-departments yet.</p>
          )}
        </CardContent>
      )}
      {edit && <GroupDialog open={edit} onOpenChange={setEdit} group={group} mode={group.mode} />}
      {addSub && <SubDeptDialog open={addSub} onOpenChange={setAddSub} groupId={group.id} />}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete group "${group.title}"?`}
        description="This removes the group and everything under it. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => del.mutate(group.id)}
      />
    </Card>
  )
}

// ─── Mode panel ──────────────────────────────────────────────────────────────
function ModePanel({ groups, mode }: { groups: AdminCareerGroup[]; mode: CareerDbMode }) {
  const [addGroup, setAddGroup] = useState(false)
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddGroup(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add group
        </Button>
      </div>
      {groups.length === 0 ? (
        <EmptyState title="No groups" description="Create the first group for this mode." />
      ) : (
        groups.map((g) => <GroupCard key={g.id} group={g} />)
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
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
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
