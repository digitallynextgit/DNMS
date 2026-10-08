import { NextRequest } from "next/server"
import { withSession } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { getReferableRoles } from "@/features/referrals/server/referrals.queries"

// Open to every employee: only the PUBLISHED job board, the same list the public careers site serves.
export const GET = withSession(async (_req: NextRequest) => ok(await getReferableRoles()))
