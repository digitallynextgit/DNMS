"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  useProjectTeams,
  useCreateTeam,
  useDeleteTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  usePromoteTeamMember,
  type ProjectTeam,
} from "@/features/projects/hooks/use-projects"
import { useEmployees } from "@/features/employees"
import {
  Plus,
  Crown,
  MoreVertical,
  Trash2,
  UserPlus,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { cn, getInitials } from "@/lib/utils"
import { ViewToggle, useViewMode } from "@/components/shared/view-toggle"
import Link from "next/link"

interface Props {
  projectId: string
  canManage: boolean
  currentUserId: string
}

export function TeamsTab({ projectId, canManage, currentUserId }: Props) {
  const { data, isLoading } = useProjectTeams(projectId)
  const teams = data?.data ?? []

  const [createOpen, setCreateOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [viewMode, setViewMode] = useViewMode(`project:${projectId}:teams`)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {teams.length} {teams.length === 1 ? "team" : "teams"}
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
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No teams yet. {canManage && "Click 'Add Team' to start organising this project."}
          </CardContent>
        </Card>
      ) : viewMode === "table" ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-border border-b">
                  <tr className="text-muted-foreground text-left text-xs tracking-wider uppercase">
                    <th className="px-4 py-2.5 font-medium">Team</th>
                    <th className="px-4 py-2.5 font-medium">Manager</th>
                    <th className="px-4 py-2.5 text-center font-medium">Members</th>
                    <th className="px-4 py-2.5 text-center font-medium">Tasks</th>
                    <th className="px-4 py-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {teams.map((team) => (
                    <tr key={team.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{team.name}</p>
                        {team.description && (
                          <p className="text-muted-foreground max-w-[300px] truncate text-xs">
                            {team.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {team.manager ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              {team.manager.profilePhoto && (
                                <AvatarImage src={team.manager.profilePhoto} />
                              )}
                              <AvatarFallback className="text-[9px]">
                                {getInitials(team.manager.firstName, team.manager.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs">
                              <Crown className="mr-0.5 inline h-3 w-3 text-amber-500" />
                              {team.manager.firstName} {team.manager.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5 text-center">
                        {team.members.length}
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5 text-center">
                        {team._count.tasks}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            setExpanded({ ...expanded, [team.id]: !expanded[team.id] })
                          }
                        >
                          {expanded[team.id] ? "Hide" : "View"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              expanded={!!expanded[team.id]}
              onToggle={() => setExpanded({ ...expanded, [team.id]: !expanded[team.id] })}
              projectId={projectId}
              canManage={canManage}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {/* Detail panels for tables - show expanded team contents below the table */}
      {viewMode === "table" &&
        teams
          .filter((t) => expanded[t.id])
          .map((team) => (
            <TeamCard
              key={`exp-${team.id}`}
              team={team}
              expanded
              onToggle={() => setExpanded({ ...expanded, [team.id]: false })}
              projectId={projectId}
              canManage={canManage}
              currentUserId={currentUserId}
            />
          ))}

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
  expanded,
  onToggle,
  projectId,
  canManage,
  currentUserId,
}: {
  team: ProjectTeam
  expanded: boolean
  onToggle: () => void
  projectId: string
  canManage: boolean
  currentUserId: string
}) {
  const isManager = team.managerId === currentUserId
  const deleteTeam = useDeleteTeam(projectId)
  const [addOpen, setAddOpen] = useState(false)

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <button onClick={onToggle} className="flex flex-1 items-center gap-2 text-left">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <div>
              <p className="font-medium">{team.name}</p>
              {team.description && (
                <p className="text-muted-foreground mt-0.5 text-xs">{team.description}</p>
              )}
            </div>
          </button>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs">
              {team.members.length} {team.members.length === 1 ? "member" : "members"} ·{" "}
              {team._count.tasks} tasks
            </span>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => {
                      if (
                        confirm(`Delete team "${team.name}"? This removes all members and tasks.`)
                      )
                        deleteTeam.mutate(team.id)
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Team
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {team.manager ? (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-6 w-6">
                {team.manager.profilePhoto && <AvatarImage src={team.manager.profilePhoto} />}
                <AvatarFallback className="text-[9px]">
                  {getInitials(team.manager.firstName, team.manager.lastName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">
                <Crown className="mr-0.5 inline h-3 w-3 text-amber-500" />
                {team.manager.firstName} {team.manager.lastName}
              </span>
            </div>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
            >
              No manager
            </Badge>
          )}
        </div>

        {expanded && (
          <div className="space-y-2 border-t pt-2">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Members
              </p>
              {(canManage || isManager) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddOpen(true)}
                  className="h-7 text-xs"
                >
                  <UserPlus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              )}
            </div>
            {team.members.length === 0 ? (
              <p className="text-muted-foreground text-xs">No members yet.</p>
            ) : (
              <ul className="space-y-1">
                {team.members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    isManagerRow={m.employeeId === team.managerId}
                    projectId={projectId}
                    teamId={team.id}
                    canManage={canManage}
                    canRemove={canManage || isManager}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        <AddMemberDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          projectId={projectId}
          teamId={team.id}
          existingMemberIds={team.members.map((m) => m.employeeId)}
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

  return (
    <li className="flex items-center justify-between py-1 text-sm">
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          {member.employee.profilePhoto && <AvatarImage src={member.employee.profilePhoto} />}
          <AvatarFallback className="text-[9px]">
            {getInitials(member.employee.firstName, member.employee.lastName)}
          </AvatarFallback>
        </Avatar>
        <span>
          {member.employee.firstName} {member.employee.lastName}
          {isManagerRow && <Crown className="ml-1 inline h-3 w-3 text-amber-500" />}
        </span>
        {member.employee.designation?.title && (
          <span className="text-muted-foreground text-xs">
            · {member.employee.designation.title}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {canManage && !isManagerRow && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => promote.mutate(member.id)}
          >
            <Crown className="mr-1 h-3 w-3" />
            Make Manager
          </Button>
        )}
        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive h-6 w-6"
            onClick={() => {
              if (confirm(`Remove ${member.employee.firstName} from this team?`))
                removeMember.mutate(member.id)
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Team</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Web Development"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-desc">Description (optional)</Label>
            <Textarea
              id="team-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || create.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddMemberDialog({
  open,
  onClose,
  projectId,
  teamId,
  existingMemberIds,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  teamId: string
  existingMemberIds: string[]
}) {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string>("")
  const { data: empsData } = useEmployees({ status: "ACTIVE", limit: 100 })
  const add = useAddTeamMember(projectId, teamId)

  const employees = (empsData?.data ?? []).filter(
    (e) =>
      !existingMemberIds.includes(e.id) &&
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()),
  )

  function handleAdd() {
    if (!selected) return
    add.mutate(selected, {
      onSuccess: () => {
        setSelected("")
        setSearch("")
        onClose()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-72 divide-y overflow-y-auto rounded border">
            {employees.length === 0 ? (
              <p className="text-muted-foreground p-4 text-center text-sm">No matching employees</p>
            ) : (
              employees.map((e) => (
                <button
                  key={e.id}
                  className={cn(
                    "hover:bg-muted/50 flex w-full items-center gap-2 p-2 text-left text-sm",
                    selected === e.id && "bg-accent",
                  )}
                  onClick={() => setSelected(e.id)}
                >
                  <Avatar className="h-7 w-7">
                    {e.profilePhoto && <AvatarImage src={e.profilePhoto} />}
                    <AvatarFallback className="text-[10px]">
                      {getInitials(e.firstName, e.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {e.firstName} {e.lastName}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {e.employeeNo} · {e.designation?.title ?? "—"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!selected || add.isPending}>
            Add Member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
