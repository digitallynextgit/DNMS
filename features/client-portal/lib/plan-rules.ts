// =============================================================================
// What a client may do to a plan item, as a rule rather than prose.
//
// Pure and client-safe on purpose - no `server-only`, no Prisma. The list uses
// it to decide whether to draw a button and the delete uses it to decide
// whether to obey, so the portal cannot offer a withdrawal the server then
// refuses. Same discipline as the deliverable lifecycle table.
// =============================================================================

/** The fields the rule needs. The DB row and the API row both satisfy it. */
export interface WithdrawableLike {
  /** Set when an EMPLOYEE wrote the row. */
  loggedById: string | null
  /** Set when the row came from the portal. */
  loggedByClientId: string | null
  status: string
}

/**
 * May this client withdraw this item?
 *
 * Three conditions, and each closes a different way of doing damage:
 *
 *   their own request  - a client takes back what THEY asked for. Work the
 *                        team planned is the team's to drop.
 *   not a staff entry  - `loggedById` set means an employee wrote the row,
 *                        whatever else is on it.
 *   still PLANNED      - the moment anybody starts, the row is a record of
 *                        real work. Deleting it would erase that, and "we
 *                        never asked for this" is not something a client gets
 *                        to say after the team has already made it.
 */
export function mayWithdraw(row: WithdrawableLike, clientUserId: string): boolean {
  if (row.loggedById) return false
  if (!row.loggedByClientId || row.loggedByClientId !== clientUserId) return false
  return row.status === "PLANNED"
}
