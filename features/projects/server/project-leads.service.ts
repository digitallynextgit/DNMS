import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { LEAD_LABEL, type ProjectLeadIds, type ProjectLeadRole } from "../lib/project-leads"

// Who may change a project's Account Managers (see lib/project-leads.ts), and the checks every change
// goes through - shared by creating and editing a project.

export class LeadChangeError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 422,
  ) {
    super(message)
  }
}

/** undefined = leave alone, null = clear (the secondary only), a string = this employee. */
export type LeadInput = Partial<Record<ProjectLeadRole, string | null>>

const primary = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined

/**
 * The two from a request body. The primary can't be cleared, so null/"" there means "leave it" (an
 * edit form resends every field). `ownerId` is accepted for the primary: the project's own data
 * calls it that.
 */
export function leadInputFrom(body: Record<string, unknown>): LeadInput {
  const secondary = body.secondaryAccountManagerId
  return {
    ACCOUNT_MANAGER: primary(
      body.accountManagerId !== undefined ? body.accountManagerId : body.ownerId,
    ),
    SECONDARY_ACCOUNT_MANAGER: secondary === undefined ? undefined : (primary(secondary) ?? null),
  }
}

export interface LeadChange {
  /** Columns to write; only the ones that change. The primary is never cleared. */
  data: { ownerId?: string; secondaryAccountManagerId?: string | null }
  /** Who was just given a role, to tell them. */
  assigned: { role: ProjectLeadRole; employeeId: string }[]
}

/**
 * Check a change against the rules. `current` is the project as it is now (null when creating).
 * - The primary Account Manager (as they are BEFORE this change) or a project admin changes either:
 *   hands the project over, or picks the secondary. The secondary changes neither.
 * - Both are active employees of this company, and not the same person; promoting the secondary
 *   empties the secondary slot.
 */
export async function planLeadChange(
  session: Session,
  current: ProjectLeadIds | null,
  input: LeadInput,
): Promise<LeadChange> {
  const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
  const nextPrimary = input.ACCOUNT_MANAGER ?? undefined
  const nextSecondary = input.SECONDARY_ACCOUNT_MANAGER
  const primaryChanges = nextPrimary !== undefined && nextPrimary !== current?.ownerId
  const secondaryChanges =
    nextSecondary !== undefined && nextSecondary !== (current?.secondaryAccountManagerId ?? null)

  const isPrimary = !!current && current.ownerId === session.user.id
  if ((primaryChanges || secondaryChanges) && !isAdmin && !isPrimary) {
    const what = primaryChanges ? "change the" : "choose the"
    const role = primaryChanges ? LEAD_LABEL.ACCOUNT_MANAGER : LEAD_LABEL.SECONDARY_ACCOUNT_MANAGER
    throw new LeadChangeError(
      `Only the ${LEAD_LABEL.ACCOUNT_MANAGER} or a project admin can ${what} ${role}.`,
      403,
    )
  }

  // Looked up through the tenant guard, so another company's employee reads as "not found".
  const named: [ProjectLeadRole, string][] = []
  if (primaryChanges) named.push(["ACCOUNT_MANAGER", nextPrimary])
  if (secondaryChanges && nextSecondary) named.push(["SECONDARY_ACCOUNT_MANAGER", nextSecondary])
  const people = named.length
    ? await db.employee.findMany({
        where: { id: { in: named.map(([, id]) => id) } },
        select: { id: true, isActive: true },
      })
    : []
  for (const [role, id] of named) {
    const person = people.find((p) => p.id === id)
    if (!person) throw new LeadChangeError(`${LEAD_LABEL[role]} not found`, 422)
    if (!person.isActive) {
      throw new LeadChangeError(`${LEAD_LABEL[role]} is not an active employee`, 422)
    }
  }

  const data: LeadChange["data"] = {}
  if (primaryChanges) data.ownerId = nextPrimary
  if (secondaryChanges) data.secondaryAccountManagerId = nextSecondary

  const afterPrimary = data.ownerId ?? current?.ownerId
  const afterSecondary = secondaryChanges
    ? nextSecondary
    : (current?.secondaryAccountManagerId ?? null)
  if (afterPrimary && afterSecondary === afterPrimary) {
    // The secondary was promoted to primary in this change: their old slot empties.
    if (primaryChanges && !secondaryChanges) data.secondaryAccountManagerId = null
    else {
      throw new LeadChangeError(
        `The ${LEAD_LABEL.SECONDARY_ACCOUNT_MANAGER} must be someone other than the ${LEAD_LABEL.ACCOUNT_MANAGER}.`,
        422,
      )
    }
  }

  return { data, assigned: named.map(([role, employeeId]) => ({ role, employeeId })) }
}
