import { withErrorHandler, respond } from "@/server/api-handler"
import { getEmployeeCodes } from "@/features/employees/server/employees.service"

export const GET = withErrorHandler(async () => respond(await getEmployeeCodes()))
