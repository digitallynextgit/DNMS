import { db } from "@/server/db"

// One-off: remove the throwaway employees created while verifying the add-employee
// flow. Scoped tightly to the test email pattern so nothing real is touched.
async function main() {
  const where = { email: { startsWith: "test.hire.", endsWith: "@company.com" } }
  const victims = await db.employee.findMany({
    where,
    select: { id: true, employeeNo: true, firstName: true, lastName: true, email: true },
  })
  console.log(`Matched ${victims.length} test employee(s):`)
  victims.forEach((v) => console.log(`  ${v.employeeNo}  ${v.firstName} ${v.lastName}  ${v.email}`))
  if (victims.length === 0) return
  // EmployeeDocument + EmployeeRole cascade on employee delete.
  const res = await db.employee.deleteMany({ where })
  console.log(`Deleted ${res.count} employee(s) (documents + roles cascaded).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => process.exit())
