import { withErrorHandler, respond } from "@/server/api-handler"
import { getOrgChart } from "@/features/employees/server/employees.service"

// GET /api/employees/org-chart - reporting-line tree of active employees.
export const GET = withErrorHandler(async () => respond(await getOrgChart()))
