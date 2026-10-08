import { withErrorHandler, respond } from "@/server/api-handler"
import { getOrgChart } from "@/features/employees/server/employees.service"

export const GET = withErrorHandler(async () => respond(await getOrgChart()))
