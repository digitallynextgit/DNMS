"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { FormDialog } from "@/components/shared/form-dialog"
import type { ProjectTeam } from "../../hooks/use-projects"
import type { WorkbookTeam } from "../../lib/sheet-types"
import { PersonAvatar } from "./person-bits"

// Offers only this team's members (not the whole project); the server refuses anyone else too.

export function TeamPeopleDialog({
  open,
  onClose,
  team,
  projectTeams,
  onSave,
  pending,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  team: WorkbookTeam
  projectTeams: ProjectTeam[]
  onSave: (employeeIds: string[]) => void
  pending: boolean
}) {
  const roster = React.useMemo(
    () => projectTeams.find((t) => t.id === team.teamId)?.members ?? [],
    [projectTeams, team.teamId],
  )

  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<string[]>([])

  const [prevOpen, setPrevOpen] = React.useState(false)
  const [prevMembers, setPrevMembers] = React.useState(team.members)
  if (open !== prevOpen || team.members !== prevMembers) {
    setPrevOpen(open)
    setPrevMembers(team.members)
    if (open) {
      setSelected(team.members.map((m) => m.employeeId))
      setSearch("")
    }
  }

  const people = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return roster
    return roster.filter((m) =>
      `${m.employee?.firstName ?? ""} ${m.employee?.lastName ?? ""} ${m.employee?.designation?.title ?? ""}`
        .toLowerCase()
        .includes(q),
    )
  }, [roster, search])

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      size="sm"
      contentClassName="lg:max-w-lg"
      title={`Who is on ${team.teamName} this month?`}
      description="Everyone here is on that team. To add somebody else, put them on the team first."
      isPending={pending}
      submitLabel={
        selected.length === 0
          ? "Save"
          : `Save ${selected.length} ${selected.length === 1 ? "person" : "people"}`
      }
      onSubmit={(e) => {
        e.preventDefault()
        onSave(selected)
      }}
    >
      {roster.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          Nobody is on the {team.teamName} team yet. Add them on the Teams tab first.
        </p>
      ) : (
        <>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              autoFocus
              className="pl-9"
              placeholder="Search this team…"
              aria-label="Search this team"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            {people.map((m) => {
              const p = m.employee
              if (!p) return null
              const on = selected.includes(p.id)
              return (
                <label
                  key={p.id}
                  className={cn(
                    "hover:bg-foreground/5 flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5",
                    on && "bg-primary/5",
                  )}
                >
                  <Checkbox checked={on} onCheckedChange={() => toggle(p.id)} />
                  <PersonAvatar
                    person={{
                      firstName: p.firstName,
                      lastName: p.lastName,
                      profilePhoto: p.profilePhoto ?? null,
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {p.firstName} {p.lastName}
                  </span>
                  {p.designation?.title && (
                    <span className="text-muted-foreground truncate text-[11px]">
                      {p.designation.title}
                    </span>
                  )}
                </label>
              )
            })}
            {people.length === 0 && (
              <p className="text-muted-foreground py-3 text-center text-xs">
                Nobody on this team matches that.
              </p>
            )}
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
        </>
      )}
    </FormDialog>
  )
}
