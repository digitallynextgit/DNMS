"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormDialog } from "@/components/shared/form-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  useProjectTeams,
  useCreateTeam,
  useDeleteTeam,
  useAddTeamMembers,
  useRemoveTeamMember,
  usePromoteTeamMember,
  useAssignableEmployees,
  type ProjectTeam,
} from "@/features/projects/hooks/use-projects"
import {
  Plus,
  Crown,
  MoreVertical,
  Trash2,
  UserPlus,
  ChevronDown,
  ChevronRight,
  Users,
  Search,
  UserMinus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ViewToggle, useViewMode } from "@/components/shared/view-toggle"

interface Props {
  projectId: string
  canManage: boolean
  currentUserId: string
}

/** Overlapping avatars so a collapsed team still shows WHO is on it. */
function AvatarStack({ members, max = 4 }: { members: ProjectTeam["members"]; max?: number }) {
  if (members.length === 0) return null
  const shown = members.slice(0, max)
  const rest = members.length - shown.length
  return (
    <div className="flex -space-x-1.5">
      {shown.map((m) => (
        <AvatarDisplay
          key={m.id}
          src={m.employee.profilePhoto}
          firstName={m.employee.firstName}
          lastName={m.employee.lastName}
          size="xs"
          className="ring-background h-6 w-6 ring-2"
        />
      ))}
      {rest > 0 && (
        <span className="bg-muted text-muted-foreground ring-background flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium ring-2">
          +{rest}
        </span>
      )}
    </div>
  )
}

export function TeamsTab({ projectId, canManage, currentUserId }: Props) {
  const { data, isLoading } = useProjectTeams(projectId)
  const teams = useMemo(() => data?.data ?? [], [data])

  const [createOpen, setCreateOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [viewMode, setViewMode] = useViewMode(`project:${projectId}:teams`)

  // Members are the point of this tab, so teams start OPEN. Past the first few
  // that would be a wall of names, so collapse the rest.
  useEffect(() => {
    if (teams.length > 3) {
      setCollapsed((prev) => {
        if (Object.keys(prev).length > 0) return prev
        return Object.fromEntries(teams.slice(3).map((t) => [t.id, true]))
      })
    }
  }, [teams])

  const totalPeople = useMemo(
    () => new Set(teams.flatMap((t) => t.members.map((m) => m.employeeId))).size,
    [teams],
  )

  const columns: DataTableColumn<ProjectTeam>[] = [
    {
      header: "Team",
      cell: (team) => (
        <>
          <p className="font-medium">{team.name}</p>
          {team.description && (
            <p className="text-muted-foreground max-w-75 truncate text-xs">{team.description}</p>
          )}
        </>
      ),
    },
    {
      header: "Manager",
      cell: (team) =>
        team.manager ? (
          <div className="flex items-center gap-1.5">
            <AvatarDisplay
              src={team.manager.profilePhoto}
              firstName={team.manager.firstName}
              lastName={team.manager.lastName}
              size="xs"
            />
            <span className="text-xs">
              {team.manager.firstName} {team.manager.lastName}
            </span>
          </div>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            unassigned
          </Badge>
        ),
    },
    { header: "Members", align: "center", cell: (team) => team.members.length },
    { header: "Tasks", align: "center", cell: (team) => team._count.tasks },
    {
      header: "",
      align: "right",
      cell: (team) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setCollapsed({ ...collapsed, [team.id]: !collapsed[team.id] })}
        >
          {collapsed[team.id] === false ? "Hide" : "View"}
        </Button>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {teams.length} {teams.length === 1 ? "team" : "teams"}
          {totalPeople > 0 && (
            <span className="text-muted-foreground font-normal">
              {" · "}
              {totalPeople} {totalPeople === 1 ? "person" : "people"}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <ViewToggle value={viewMode} onChange={setViewMode} />
          {canManage && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add Team
            </Button>
          )}
        </div>
      </div>

      {teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams yet"
          description={
            canManage
              ? "Teams group the people working on this project. Tasks are assigned within a team."
              : "A project manager needs to create a team first."
          }
          action={canManage ? { label: "Add Team", onClick: () => setCreateOpen(true) } : undefined}
        />
      ) : viewMode === "table" ? (
        <>
          <DataTable columns={columns} rows={teams} rowKey={(team) => team.id} showSerial />
          {teams
            .filter((t) => collapsed[t.id] === false)
            .map((team) => (
              <TeamCard
                key={`exp-${team.id}`}
                team={team}
                open
                onToggle={() => setCollapsed({ ...collapsed, [team.id]: true })}
                projectId={projectId}
                canManage={canManage}
                currentUserId={currentUserId}
              />
            ))}
        </>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              open={!collapsed[team.id]}
              onToggle={() => setCollapsed({ ...collapsed, [team.id]: !collapsed[team.id] })}
              projectId={projectId}
              canManage={canManage}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      <CreateTeamDialog
        projectId={projectId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  )
}

function TeamCard({
  team,
  open,
  onToggle,
  projectId,
  canManage,
  currentUserId,
}: {
  team: ProjectTeam
  open: boolean
  onToggle: () => void
  projectId: string
  canManage: boolean
  currentUserId: string
}) {
  const isManager = team.managerId === currentUserId
  const canStaff = canManage || isManager
  const deleteTeam = useDeleteTeam(projectId)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // The manager is a member like anyone else - listed ONCE, badged. Showing them
  // again in the header (as this used to) read as two different people.
  const members = [...team.members].sort((a, b) => {
    if (a.employeeId === team.managerId) return -1
    if (b.employeeId === team.managerId) return 1
    return a.employee.firstName.localeCompare(b.employee.firstName)
  })

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onToggle}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="truncate font-medium">{team.name}</p>
              {team.description && (
                <p className="text-muted-foreground truncate text-xs">{team.description}</p>
              )}
            </div>
            {!team.manager && (
              <Badge
                variant="outline"
                className="ml-1 shrink-0 border-amber-500/40 text-[10px] text-amber-600"
              >
                no manager
              </Badge>
            )}
          </button>

          <div className="flex shrink-0 items-center gap-3">
            <AvatarStack members={members} />
            <span className="text-muted-foreground hidden text-xs whitespace-nowrap sm:inline">
              {team.members.length} {team.members.length === 1 ? "member" : "members"} ·{" "}
              {team._count.tasks} {team._count.tasks === 1 ? "task" : "tasks"}
            </span>
            {canStaff && (
              <Button size="sm" variant="outline" className="h-7" onClick={() => setAddOpen(true)}>
                <UserPlus className="mr-1 h-3.5 w-3.5" />
                Add people
              </Button>
            )}
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete team
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {open && (
          <div className="border-t">
            {members.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm font-medium">No one on this team yet</p>
                <p className="text-muted-foreground text-xs">
                  {canStaff
                    ? "Add people so tasks can be assigned to them."
                    : "The team manager can add people."}
                </p>
                {canStaff && (
                  <Button size="sm" className="mt-3" onClick={() => setAddOpen(true)}>
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    Add people
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-border/60 divide-y">
                {members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    isManagerRow={m.employeeId === team.managerId}
                    projectId={projectId}
                    teamId={team.id}
                    canManage={canManage}
                    canRemove={canStaff}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        <AddMembersDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          projectId={projectId}
          teamId={team.id}
          teamName={team.name}
          existingMemberIds={team.members.map((m) => m.employeeId)}
        />

        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete team"
          description={`Delete team "${team.name}"? This removes all members and tasks.`}
          confirmLabel="Delete Team"
          variant="destructive"
          isLoading={deleteTeam.isPending}
          onConfirm={() => deleteTeam.mutate(team.id, { onSuccess: () => setDeleteOpen(false) })}
        />
      </CardContent>
    </Card>
  )
}

function MemberRow({
  member,
  isManagerRow,
  projectId,
  teamId,
  canManage,
  canRemove,
}: {
  member: ProjectTeam["members"][number]
  isManagerRow: boolean
  projectId: string
  teamId: string
  canManage: boolean
  canRemove: boolean
}) {
  const removeMember = useRemoveTeamMember(projectId, teamId)
  const promote = usePromoteTeamMember(projectId, teamId)
  const [removeOpen, setRemoveOpen] = useState(false)
  const name = `${member.employee.firstName} ${member.employee.lastName}`

  return (
    <li className="hover:bg-muted/40 flex items-center gap-3 px-4 py-2.5">
      <AvatarDisplay
        src={member.employee.profilePhoto}
        firstName={member.employee.firstName}
        lastName={member.employee.lastName}
        size="sm"
        className="h-8 w-8 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{name}</span>
          {isManagerRow && (
            <Badge
              variant="outline"
              className="shrink-0 gap-1 border-amber-500/40 text-[10px] text-amber-600"
            >
              <Crown className="h-2.5 w-2.5" />
              Manager
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground truncate text-xs">
          {member.employee.designation?.title ?? "No designation"}
        </p>
      </div>

      {canRemove && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canManage && !isManagerRow && (
              <>
                <DropdownMenuItem onClick={() => promote.mutate(member.id)}>
                  <Crown className="mr-2 h-4 w-4" />
                  Make manager
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem className="text-destructive" onClick={() => setRemoveOpen(true)}>
              <UserMinus className="mr-2 h-4 w-4" />
              Remove from team
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove member"
        description={`Remove ${name} from this team? Their tasks stay on the project.`}
        confirmLabel="Remove"
        variant="destructive"
        isLoading={removeMember.isPending}
        onConfirm={() => removeMember.mutate(member.id, { onSuccess: () => setRemoveOpen(false) })}
      />
    </li>
  )
}

function CreateTeamDialog({
  projectId,
  open,
  onClose,
}: {
  projectId: string
  open: boolean
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const create = useCreateTeam(projectId)

  function handleCreate() {
    if (!name.trim()) return
    create.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      {
        onSuccess: () => {
          setName("")
          setDescription("")
          onClose()
        },
      },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title="Add Team"
      description="Teams group the people working on this project. Tasks are assigned within a team."
      isPending={create.isPending}
      submitDisabled={!name.trim()}
      submitLabel="Create team"
      size="sm"
      onSubmit={(e) => {
        e.preventDefault()
        handleCreate()
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="team-name">Team name</Label>
        <Input
          id="team-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Web Development"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="team-desc">Description (optional)</Label>
        <Textarea
          id="team-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What this team is responsible for"
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Add people once it exists — the first person can then be made manager.
      </p>
    </FormDialog>
  )
}

/**
 * Multi-select roster. Staffing a team used to mean reopening this dialog once
 * per person; now you tick everyone and add them in one go.
 */
function AddMembersDialog({
  open,
  onClose,
  projectId,
  teamId,
  teamName,
  existingMemberIds,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  teamId: string
  teamName: string
  existingMemberIds: string[]
}) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  // Project-scoped roster: /api/employees needs global `employee:read`, which an
  // Account Manager (a plain employee who owns the project) doesn't have.
  const { data: empsData } = useAssignableEmployees(projectId, open)
  const add = useAddTeamMembers(projectId, teamId)

  useEffect(() => {
    if (open) {
      setSelected([])
      setSearch("")
    }
  }, [open])

  const employees = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (empsData?.data ?? [])
      .filter((e) => !existingMemberIds.includes(e.id))
      .filter((e) =>
        !q
          ? true
          : // Name, employee number OR designation - people search by all three
            // and only name used to match.
            `${e.firstName} ${e.lastName} ${e.employeeNo} ${e.designation?.title ?? ""}`
              .toLowerCase()
              .includes(q),
      )
  }, [empsData, existingMemberIds, search])

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title={`Add people to ${teamName}`}
      description="Pick everyone you need - they're all added at once."
      isPending={add.isPending}
      submitDisabled={selected.length === 0}
      submitLabel={
        selected.length === 0
          ? "Add people"
          : `Add ${selected.length} ${selected.length === 1 ? "person" : "people"}`
      }
      onSubmit={(e) => {
        e.preventDefault()
        if (selected.length === 0) return
        add.mutate(selected, { onSuccess: () => onClose() })
      }}
    >
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          autoFocus
          className="pl-9"
          placeholder="Search by name, employee no. or designation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{selected.length} selected</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground underline"
            onClick={() => setSelected([])}
          >
            Clear
          </button>
        </div>
      )}

      <div className="divide-border/60 max-h-80 divide-y overflow-y-auto rounded border">
        {employees.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            {search ? "No one matches that search." : "Everyone available is already on this team."}
          </p>
        ) : (
          employees.map((e) => {
            const checked = selected.includes(e.id)
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => toggle(e.id)}
                className={cn(
                  "hover:bg-muted/50 flex w-full items-center gap-3 p-2.5 text-left",
                  checked && "bg-accent/60",
                )}
              >
                <Checkbox checked={checked} className="pointer-events-none shrink-0" />
                <AvatarDisplay
                  src={e.profilePhoto}
                  firstName={e.firstName}
                  lastName={e.lastName}
                  size="sm"
                  className="h-8 w-8 shrink-0"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {e.firstName} {e.lastName}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {e.employeeNo} · {e.designation?.title ?? "No designation"}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </FormDialog>
  )
}
