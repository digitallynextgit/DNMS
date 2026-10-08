// Pure and client-safe: the list uses it to draw the button and the delete to obey, so they agree.

/** The fields the rule needs. The DB row and the API row both satisfy it. */
export interface WithdrawableLike {
  /** Set when an EMPLOYEE wrote the row. */
  loggedById: string | null
  /** Set when the row came from the portal. */
  loggedByClientId: string | null
  status: string
}

/** Only the client's own request, never a staff entry, and only while still PLANNED. */
export function mayWithdraw(row: WithdrawableLike, clientUserId: string): boolean {
  if (row.loggedById) return false
  if (!row.loggedByClientId || row.loggedByClientId !== clientUserId) return false
  return row.status === "PLANNED"
}
