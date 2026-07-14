import { Prisma } from "@prisma/client"
import { HIDDEN_ROLES } from "@/lib/constants"

/**
 * Prisma `where` fragment that excludes hidden accounts (the `admin_` silent
 * watch account) from ANY employee query - counts, listings, charts, groupBy.
 * Spread into a where: `where: { isActive: true, ...VISIBLE_EMPLOYEE_FILTER }`.
 */
export const VISIBLE_EMPLOYEE_FILTER = {
  employeeRoles: { none: { role: { name: { in: [...HIDDEN_ROLES] } } } },
} satisfies Prisma.EmployeeWhereInput

/**
 * Minimal employee fields for nested "who" references across the app
 * (avatars, names, employee numbers in tables/cards). Use as a Prisma
 * `select` so every relation that embeds an employee returns the same shape.
 *
 * For supersets, spread it: `{ ...EMPLOYEE_SUMMARY_SELECT, department: {...} }`.
 */
export const EMPLOYEE_SUMMARY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  employeeNo: true,
  profilePhoto: true,
} satisfies Prisma.EmployeeSelect

/**
 * Exactly the fields the employee DIRECTORY renders - mirrors the
 * `EmployeeListItem` contract in features/employees/hooks/use-employees.ts.
 *
 * Use this instead of a bare `include:`, which makes Prisma return EVERY scalar
 * on Employee - that is how the address / emergencyContact JSON blobs (and, before
 * the global omit in server/db.ts, passwordHash + gmailAppPassword) ended up in
 * the list payload. The address blobs live on EmployeeDetail, not the list.
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
