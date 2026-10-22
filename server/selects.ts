import { Prisma } from "@prisma/client"
import { HIDDEN_ROLES } from "@/lib/constants"

/** Hides the silent `admin_` watch account from employee queries; spread into a `where`. */
export const VISIBLE_EMPLOYEE_FILTER = {
  employeeRoles: { none: { role: { name: { in: [...HIDDEN_ROLES] } } } },
} satisfies Prisma.EmployeeWhereInput

/** The standard shape for a nested "who" reference to an employee. */
export const EMPLOYEE_SUMMARY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  employeeNo: true,
  profilePhoto: true,
} satisfies Prisma.EmployeeSelect

/** Projects still being worked on: not archived, not finished or cancelled. */
const LIVE_PROJECT: Prisma.ProjectWhereInput = {
  isArchived: false,
  status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] },
}

const PROJECT_LABEL = { id: true, name: true, shortName: true, slug: true } as const

/**
 * Exactly what the directory renders (`EmployeeListItem`). Never use a bare `include` there - it
 * returns every scalar, address JSON blobs included.
 */
export const EMPLOYEE_LIST_SELECT = {
  id: true,
  employeeNo: true,
  deviceId: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  personalEmail: true,
  personalPhone: true,
  dateOfBirth: true,
  gender: true,
  nationality: true,
  bloodGroup: true,
  profilePhoto: true,
  status: true,
  employmentType: true,
  dateOfJoining: true,
  probationEndDate: true,
  onProbation: true,
  probationMonths: true,
  workLocation: true,
  isActive: true,
  createdAt: true,
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, title: true, code: true, level: true } },
  jobRole: { select: { id: true, name: true } },
  manager: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
  dottedManager: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
  // The projects they run as account manager, and what they do on the rest - live projects only.
  ownedProjects: { where: LIVE_PROJECT, select: PROJECT_LABEL, orderBy: { name: "asc" } },
  secondaryAmProjects: { where: LIVE_PROJECT, select: PROJECT_LABEL, orderBy: { name: "asc" } },
  projectTeamMemberships: {
    where: { team: { project: LIVE_PROJECT } },
    select: { team: { select: { name: true, project: { select: PROJECT_LABEL } } } },
  },
  managedTeams: {
    where: { project: LIVE_PROJECT },
    select: { name: true, project: { select: PROJECT_LABEL } },
  },
  ownedProjectServices: {
    where: { project: LIVE_PROJECT },
    select: { service: true, project: { select: PROJECT_LABEL } },
  },
  secondaryServiceOwnerships: {
    where: { project: LIVE_PROJECT },
    select: { service: true, project: { select: PROJECT_LABEL } },
  },
} satisfies Prisma.EmployeeSelect
