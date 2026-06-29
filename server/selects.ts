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
