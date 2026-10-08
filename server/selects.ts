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
  designation: { select: { id: true, title: true } },
  jobRole: { select: { id: true, name: true } },
  manager: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.EmployeeSelect
