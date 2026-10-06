"use client"

import { useMemo, useState } from "react"
import { Link } from "@/components/tenant-link"
import {
  Building2,
  Layers,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  Power,
  Trash2,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { FormDialog } from "@/components/shared/form-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import {
  useDeleteDepartment,
  useDepartmentsAdmin,
  useSaveDepartment,
  useSetDepartmentActive,
  type AdminDepartment,
} from "../hooks/use-department-admin"
import {
  DEPARTMENT_LEVEL_LABELS,
  MAX_DEPARTMENT_DEPTH,
  departmentDescendantIds,
  departmentParentError,
  flattenDepartmentTree,
  type FlatDepartment,
} from "../lib/department-tree"

// =============================================================================
// The Departments page as an org board: one card per top-level department
// (SMG, ADAC, MAP…), its sub-departments listed inside and sub-sub-departments
// indented under a guide line - the organogram, not a spreadsheet. Every item
// carries its outline number (1, 1.5, 1.5.1), its headcount (a link to those
// employees in the directory) and one actions menu instead of a row of icons.
// =============================================================================

/** A department in tree order, with the active headcount of it and everything below it. */
type Node = FlatDepartment<AdminDepartment> & { employees: number }

/** The parent picker's "no parent" choice. */
const TOP_LEVEL = "__top__"

/** "sub-department(s)" for running text. */
const levelNoun = (depth: number, n: number) =>
  `${(DEPARTMENT_LEVEL_LABELS[depth] ?? "Department").toLowerCase()}${n === 1 ? "" : "s"}`

interface Board {
  /** Shown children of a department, in tree order. */
  kidsOf: (id: string) => Node[]
  /** The live search, lower-cased; "" when not searching. */
  query: string
  canWrite: boolean
  busy: boolean
  onAdd: (parent: Node) => void
  onEdit: (node: Node) => void
  onToggle: (node: Node) => void
  onDelete: (node: Node) => void
}

export function DepartmentsBoard() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.EMPLOYEE_WRITE)
  const { data, isLoading } = useDepartmentsAdmin()
  const departments = useMemo(() => data ?? [], [data])
  const save = useSaveDepartment()
  const setActive = useSetDepartmentActive()
  const remove = useDeleteDepartment()

  const [search, setSearch] = useState("")
  const [form, setForm] = useState<{
    editing: Node | null
    name: string
    parentId: string
  } | null>(null)
  const [confirm, setConfirm] = useState<{ kind: "delete" | "deactivate"; node: Node } | null>(null)

  // ── The tree ──────────────────────────────────────────────────────────────
  const nodes: Node[] = useMemo(() => {
    const own = new Map(departments.map((d) => [d.id, d.activeEmployees]))
    return flattenDepartmentTree(departments).map((d) => {
      let employees = d.activeEmployees
      for (const id of departmentDescendantIds(departments, d.id)) employees += own.get(id) ?? 0
      return { ...d, employees }
    })
  }, [departments])

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, Node[]>()
    for (const n of nodes) {
      const key = n.depth === 0 ? null : n.parentId
      const list = map.get(key)
      if (list) list.push(n)
      else map.set(key, [n])
    }
    return map
  }, [nodes])

  // Search keeps a match's parents (where it sits) and children (what is in
  // it) on screen.
  const query = search.trim().toLowerCase()
  const shown = useMemo(() => {
    if (!query) return null
    const parentOf = new Map(nodes.map((n) => [n.id, n.depth === 0 ? null : n.parentId]))
    const keep = new Set<string>()
    for (const n of nodes) {
      if (!n.name.toLowerCase().includes(query)) continue
      keep.add(n.id)
      for (let p = parentOf.get(n.id) ?? null; p; p = parentOf.get(p) ?? null) keep.add(p)
      for (const d of departmentDescendantIds(departments, n.id)) keep.add(d)
    }
    return keep
  }, [nodes, departments, query])

  const kidsOf = (id: string | null) =>
    (childrenOf.get(id) ?? []).filter((n) => !shown || shown.has(n.id))
  const roots = kidsOf(null)

  // ── Actions ───────────────────────────────────────────────────────────────
  const openCreate = (parent?: Node) =>
    setForm({ editing: null, name: "", parentId: parent?.id ?? "" })
  const openEdit = (node: Node) =>
    setForm({ editing: node, name: node.name, parentId: node.parentId ?? "" })

  // Deactivating takes everything below along, so that case asks first.
  const toggleActive = (node: Node) => {
    if (node.isActive && node.childCount > 0) setConfirm({ kind: "deactivate", node })
    else setActive.mutate({ id: node.id, isActive: !node.isActive })
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form) return
    save.mutate(
      { id: form.editing?.id, name: form.name.trim(), parentId: form.parentId || null },
      { onSuccess: () => setForm(null) },
    )
  }

  // The parent picker offers only legal parents: active, not the department
  // itself or anything under it, and leaving its own subtree within 3 levels.
  const editingId = form?.editing?.id ?? null
  const parentChoices = nodes.filter(
    (n) =>
      (n.isActive || n.id === form?.editing?.parentId) &&
      departmentParentError(departments, editingId, n.id) === null,
  )
  const chosenParent = nodes.find((n) => n.id === form?.parentId)
  const levelLabel = DEPARTMENT_LEVEL_LABELS[chosenParent ? chosenParent.depth + 1 : 0]

  const board: Board = {
    kidsOf,
    query,
    canWrite,
    busy: setActive.isPending,
    onAdd: openCreate,
    onEdit: openEdit,
    onToggle: toggleActive,
    onDelete: (node) => setConfirm({ kind: "delete", node }),
  }

  // How many at each level, for the stat cards.
  const atDepth = [0, 1, 2].map((d) => nodes.filter((n) => n.depth === d).length)
  const employees = departments.reduce((sum, d) => sum + d.activeEmployees, 0)
  const pendingBelow = confirm ? departmentDescendantIds(departments, confirm.node.id).size : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Departments, their sub-departments and sub-sub-departments, and who is in each."
        actions={
          canWrite ? (
            <Button className="gap-2" onClick={() => openCreate()}>
              <Plus className="h-4 w-4" />
              Add Department
            </Button>
          ) : undefined
        }
      />

      <DepartmentStats
        loading={isLoading}
        departments={atDepth[0] ?? 0}
        subs={atDepth[1] ?? 0}
        subSubs={atDepth[2] ?? 0}
        employees={employees}
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search departments..."
        className="max-w-sm"
      />

      {isLoading ? (
        <DepartmentCardsSkeleton />
      ) : roots.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Building2}
          title={query ? "No departments match your search." : "No departments yet."}
          action={
            !query && canWrite
              ? { label: "Add Department", onClick: () => openCreate() }
              : undefined
          }
        />
      ) : (
        // Masonry: cards differ a lot in height (SMG lists ten, HR & Admin
        // none), and columns pack them without the gaps a grid row leaves.
        <div className="columns-1 gap-4 md:columns-2 2xl:columns-3">
          {roots.map((root) => (
            <DepartmentCard key={root.id} node={root} board={board} />
          ))}
        </div>
      )}

      <FormDialog
        open={!!form}
        onOpenChange={(o) => !o && setForm(null)}
        title={`${form?.editing ? "Edit" : "Add"} ${levelLabel ?? "Department"}`}
        isEdit={!!form?.editing}
        isPending={save.isPending}
        submitDisabled={!form?.name.trim()}
        size="sm"
        onSubmit={submit}
      >
        <div className="space-y-2">
          <Label required htmlFor="dept-name">
            Name
          </Label>
          <Input
            id="dept-name"
            value={form?.name ?? ""}
            onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })}
            placeholder="Marketing Services Group"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dept-parent">Sits under</Label>
          <Select
            value={form?.parentId || TOP_LEVEL}
            onValueChange={(v) => setForm((f) => f && { ...f, parentId: v === TOP_LEVEL ? "" : v })}
          >
            <SelectTrigger id="dept-parent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOP_LEVEL}>Nothing - it is a top-level department</SelectItem>
              {parentChoices.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.outline} · {n.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {chosenParent
              ? `A ${levelLabel?.toLowerCase()} of ${chosenParent.name}.`
              : `Up to ${MAX_DEPARTMENT_DEPTH} levels: department › sub-department › sub-sub-department.`}
          </p>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={confirm?.kind === "deactivate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Deactivate ${confirm?.node.name}?`}
        description={`Its ${pendingBelow} sub-department${
          pendingBelow === 1 ? "" : "s"
        } will be deactivated too. Employees stay assigned, and you can reactivate it later.`}
        confirmLabel="Deactivate"
        variant="destructive"
        isLoading={setActive.isPending}
        onConfirm={() => {
          if (!confirm) return
          setActive.mutate(
            { id: confirm.node.id, isActive: false },
            { onSuccess: () => setConfirm(null) },
          )
        }}
      />

      <ConfirmDialog
        open={confirm?.kind === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete department?"
        description={`Permanently delete "${confirm?.node.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => {
          if (!confirm) return
          remove.mutate(confirm.node.id, { onSuccess: () => setConfirm(null) })
        }}
      />
    </div>
  )
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/** How many there are at each level, and how many employees they hold. */
function DepartmentStats({
  loading,
  departments,
  subs,
  subSubs,
  employees,
}: {
  loading: boolean
  departments: number
  subs: number
  subSubs: number
  employees: number
}) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard title="Departments" value={departments} icon={Building2} loading={loading} />
      <StatCard title="Sub-departments" value={subs} icon={Network} loading={loading} />
      <StatCard title="Sub-sub-departments" value={subSubs} icon={Layers} loading={loading} />
      <StatCard
        title="Employees"
        value={employees}
        description="Active, with a department"
        icon={Users}
        loading={loading}
      />
    </div>
  )
}

/** A top-level department: its own header, then everything under it. */
function DepartmentCard({ node, board }: { node: Node; board: Board }) {
  const kids = board.kidsOf(node.id)
  const subSubs = kids.reduce((sum, k) => sum + board.kidsOf(k.id).length, 0)
  const canAdd = board.canWrite && node.isActive && !board.query
  const hasBody = kids.length > 0 || canAdd
  const summary =
    kids.length === 0
      ? "No sub-departments"
      : [
          `${kids.length} ${levelNoun(1, kids.length)}`,
          subSubs > 0 && `${subSubs} ${levelNoun(2, subSubs)}`,
        ]
          .filter(Boolean)
          .join(" · ")

  return (
    <section className="bg-card mb-4 break-inside-avoid rounded-sm border">
      <header
        className={cn(
          "flex items-center gap-3 p-4",
          hasBody && "border-b",
          !node.isActive && "opacity-60",
        )}
      >
        <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-sm font-semibold tabular-nums">
          {node.outline}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold">
              <Name name={node.name} query={board.query} />
            </h3>
            {!node.isActive && <InactiveTag />}
          </div>
          <p className="text-muted-foreground text-xs">{summary}</p>
        </div>
        <Headcount node={node} />
        {board.canWrite && <NodeMenu node={node} board={board} />}
      </header>

      {hasBody && (
        <div className="p-2">
          {kids.length > 0 && (
            <ul className="space-y-px">
              {kids.map((k) => (
                <DepartmentItem key={k.id} node={k} board={board} />
              ))}
            </ul>
          )}
          {canAdd && (
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground w-full justify-start gap-2 px-2"
              onClick={() => board.onAdd(node)}
            >
              <Plus className="h-4 w-4" />
              Add sub-department
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

/** A sub- or sub-sub-department row, with its own children indented below. */
function DepartmentItem({ node, board }: { node: Node; board: Board }) {
  const kids = board.kidsOf(node.id)
  return (
    <li>
      <div
        className={cn(
          "hover:bg-muted/40 flex min-h-9 items-center gap-2 rounded-sm pl-2 transition-colors",
          !board.canWrite && "pr-2",
          !node.isActive && "opacity-60",
        )}
      >
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{node.outline}</span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            node.depth === 1 ? "font-medium" : "text-foreground/85",
          )}
        >
          <Name name={node.name} query={board.query} />
        </span>
        {!node.isActive && <InactiveTag />}
        <Headcount node={node} />
        {board.canWrite && <NodeMenu node={node} board={board} />}
      </div>
      {/* The guide line ties sub-sub-departments to their parent. */}
      {kids.length > 0 && (
        <ul className="border-border mb-1 ml-3 space-y-px border-l pl-2">
          {kids.map((k) => (
            <DepartmentItem key={k.id} node={k} board={board} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** Headcount - a link to exactly those employees in the employee directory. */
function Headcount({ node }: { node: Node }) {
  const direct = node.activeEmployees
  const title =
    node.childCount > 0 && direct !== node.employees
      ? `${node.employees} employees in ${node.name} and its sub-departments (${direct} directly in ${node.name})`
      : `${node.employees} ${node.employees === 1 ? "employee" : "employees"} in ${node.name}`
  const body = (
    <>
      <Users className="h-3.5 w-3.5" />
      {node.employees}
    </>
  )
  const base = "inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-1 text-xs tabular-nums"
  if (node.employees === 0) {
    return (
      <span className={cn(base, "text-muted-foreground/50")} title={title}>
        {body}
      </span>
    )
  }
  return (
    <Link
      href={`/employees/employee-directory?departmentId=${node.id}`}
      title={title}
      aria-label={title}
      className={cn(base, "text-muted-foreground hover:bg-muted hover:text-foreground")}
    >
      {body}
    </Link>
  )
}

function NodeMenu({ node, board }: { node: Node; board: Board }) {
  const childLevel = DEPARTMENT_LEVEL_LABELS[node.depth + 1]
  const deletable =
    node._count.employees === 0 && node._count.jobPostings === 0 && node._count.children === 0
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label={`Actions for ${node.name}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {node.employees > 0 && (
          <DropdownMenuItem asChild>
            <Link href={`/employees/employee-directory?departmentId=${node.id}`}>
              <Users className="mr-2 h-4 w-4" />
              View {node.employees} {node.employees === 1 ? "employee" : "employees"}
            </Link>
          </DropdownMenuItem>
        )}
        {node.isActive && childLevel && (
          <DropdownMenuItem onClick={() => board.onAdd(node)}>
            <Plus className="mr-2 h-4 w-4" />
            Add {childLevel.toLowerCase()}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => board.onEdit(node)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem disabled={board.busy} onClick={() => board.onToggle(node)}>
          <Power className="mr-2 h-4 w-4" />
          {node.isActive ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        {deletable && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => board.onDelete(node)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The name, with the search hit marked. */
function Name({ name, query }: { name: string; query: string }) {
  const at = query ? name.toLowerCase().indexOf(query) : -1
  if (at < 0) return <>{name}</>
  return (
    <>
      {name.slice(0, at)}
      <mark className="text-foreground rounded-sm bg-amber-400/25">
        {name.slice(at, at + query.length)}
      </mark>
      {name.slice(at + query.length)}
    </>
  )
}

function InactiveTag() {
  return (
    <span className="text-muted-foreground shrink-0 rounded-sm border px-1.5 py-px text-[10px] font-medium">
      Inactive
    </span>
  )
}

// ── Skeletons ───────────────────────────────────────────────────────────────

/** Rows per placeholder card - uneven on purpose, like the real board. */
const SKELETON_ROWS = [5, 1, 2, 0, 4, 3]

/** The board's cards while the list loads. */
export function DepartmentCardsSkeleton() {
  return (
    <div className="columns-1 gap-4 md:columns-2 2xl:columns-3">
      {SKELETON_ROWS.map((rows, i) => (
        <div key={i} className="bg-card mb-4 break-inside-avoid rounded-sm border">
          <div className={cn("flex items-center gap-3 p-4", rows > 0 && "border-b")}>
            <Skeleton className="h-9 w-9 shrink-0 rounded-sm" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          {rows > 0 && (
            <div className="space-y-px p-2">
              {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex h-9 items-center gap-3 px-2">
                  <Skeleton className="h-3.5 max-w-40 flex-1" />
                  <Skeleton className="h-3.5 w-8" />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** The whole page, for the route's loading.tsx. */
export function DepartmentsBoardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Departments, their sub-departments and sub-sub-departments, and who is in each."
        actions={<Skeleton className="h-9 w-40" />}
      />
      <DepartmentStats loading departments={0} subs={0} subSubs={0} employees={0} />
      <Skeleton className="h-9 w-full max-w-sm" />
      <DepartmentCardsSkeleton />
    </div>
  )
}
