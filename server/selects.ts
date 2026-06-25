import { Prisma } from "@prisma/client"

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
