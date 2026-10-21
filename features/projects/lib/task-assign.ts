// Who may hand a team task to whom: yourself, and your own reports (solid or dotted line, any
// depth) who are on the team; the team's manager and the project's managers may pick anyone on it.

export interface AssignContext {
  actorId: string
  /** Manages the team, or the project (account manager / admin). */
  canAssignAnyone: boolean
  teamMemberIds: readonly string[]
  /** The actor's reporting line, from reportingLine(). */
  reportIds: readonly string[]
}

export function mayAssignTo(ctx: AssignContext, assigneeId: string): boolean {
  if (!ctx.teamMemberIds.includes(assigneeId)) return false
  return ctx.canAssignAnyone || assigneeId === ctx.actorId || ctx.reportIds.includes(assigneeId)
}

/** The team members this person may assign, in the team's order. */
export function assignableIds(ctx: AssignContext): string[] {
  return ctx.teamMemberIds.filter((id) => mayAssignTo(ctx, id))
}

/** Why an assignment is refused, for the person refused, or null when it is allowed. */
export function assignRefusal(ctx: AssignContext, assigneeId: string): string | null {
  if (!ctx.teamMemberIds.includes(assigneeId)) return "Assignee must be a member of this team"
  if (mayAssignTo(ctx, assigneeId)) return null
  return "You can give team tasks to yourself or to people who report to you; the team manager can assign anyone."
}
