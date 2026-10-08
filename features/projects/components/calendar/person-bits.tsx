"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { SheetAssignee, WorkbookTeamMember } from "../../lib/sheet-types"

/** The value a Select uses for "nobody". */
export const UNASSIGNED = "__none__"

export const initials = (p: { firstName: string; lastName: string }) =>
  `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase() || "?"

export function PersonAvatar({
  person,
  className,
}: {
  person: { firstName: string; lastName: string; profilePhoto: string | null }
  className?: string
}) {
  return (
    <Avatar className={cn("h-5 w-5 rounded-full", className)}>
      {person.profilePhoto && <AvatarImage src={person.profilePhoto} alt="" />}
      <AvatarFallback className="rounded-full text-[9px]">{initials(person)}</AvatarFallback>
    </Avatar>
  )
}

export function AssigneeChip({
  person,
  emptyLabel = "Unassigned",
}: {
  person: SheetAssignee | null
  emptyLabel?: string
}) {
  if (!person) return <span className="text-muted-foreground text-xs">{emptyLabel}</span>
  return (
    <span
      className="flex min-w-0 items-center gap-1.5"
      title={`${person.firstName} ${person.lastName}`.trim()}
    >
      <PersonAvatar person={person} />
      <span className="truncate text-xs font-medium">{person.firstName}</span>
    </span>
  )
}

export function MemberAvatars({
  people,
  max = 4,
  className,
}: {
  people: WorkbookTeamMember[]
  max?: number
  className?: string
}) {
  if (people.length === 0) {
    return <span className="text-muted-foreground/60 text-[11px]">Nobody yet</span>
  }
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  return (
    <span className={cn("flex items-center", className)}>
      {shown.map((p) => (
        <PersonAvatar
          key={p.employeeId}
          person={p}
          className="ring-background -ml-1.5 ring-2 first:ml-0"
        />
      ))}
      {rest > 0 && (
        <span className="text-muted-foreground ml-1 text-[11px] tabular-nums">+{rest}</span>
      )}
    </span>
  )
}
