import { withErrorHandler, respond } from "@/server/api-handler"
import { getEmployeeCodes } from "@/features/employees/server/employees.service"

// GET /api/employees/codes - lightweight list of employees with their codes.
export const GET = withErrorHandler(async () => respond(await getEmployeeCodes()))
