// The people who lead a project: a primary and a secondary Account Manager, both "always on" with the
// same powers (manage the whole project). `ownerId` is the PRIMARY one - a historical name. The
// primary (or an admin, project:write) hands the project over and picks the secondary.
// Each service has a primary and a secondary owner too: see project-service-owners.ts.
import type { Prisma } from "@prisma/client"

export type ProjectLeadRole = "ACCOUNT_MANAGER" | "SECONDARY_ACCOUNT_MANAGER"

/** The column behind each role, on Project. */
export const LEAD_FIELD = {
  ACCOUNT_MANAGER: "ownerId",
  SECONDARY_ACCOUNT_MANAGER: "secondaryAccountManagerId",
} as const satisfies Record<ProjectLeadRole, string>

export const LEAD_ROLES = Object.keys(LEAD_FIELD) as ProjectLeadRole[]

export const LEAD_LABEL: Record<ProjectLeadRole, string> = {
  ACCOUNT_MANAGER: "Account Manager",
  SECONDARY_ACCOUNT_MANAGER: "Secondary Account Manager",
}

/** Select these to use the helpers below. */
export const PROJECT_LEADS_SELECT = {
  ownerId: true,
  secondaryAccountManagerId: true,
} as const

export interface ProjectLeadIds {
  ownerId: string
  secondaryAccountManagerId: string | null
}

/** Prisma conditions "this employee is one of the project's Account Managers", to spread into an OR. */
export function leadConditions(employeeId: string): Prisma.ProjectWhereInput[] {
  return [{ ownerId: employeeId }, { secondaryAccountManagerId: employeeId }]
}

/** Prisma filter: projects this employee is an Account Manager of (primary or secondary). */
export function ledBy(employeeId: string): Prisma.ProjectWhereInput {
  return { OR: leadConditions(employeeId) }
}

/** Both Account Managers, deduped - who hears the project's news. */
export function accountManagerIds(p: ProjectLeadIds): string[] {
  return [...new Set([p.ownerId, p.secondaryAccountManagerId].filter((id): id is string => !!id))]
}

export function isProjectLead(p: ProjectLeadIds, employeeId: string): boolean {
  return accountManagerIds(p).includes(employeeId)
}

/** The roles this employee holds on the project. */
export function leadRolesOf(p: ProjectLeadIds, employeeId: string): ProjectLeadRole[] {
  return LEAD_ROLES.filter((role) => p[LEAD_FIELD[role]] === employeeId)
}
