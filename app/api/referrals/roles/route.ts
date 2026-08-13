import { NextRequest } from "next/server"
import { withSession } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { getReferableRoles } from "@/features/referrals/server/referrals.queries"

// GET /api/referrals/roles - the roles any employee may refer somebody to.
//
// withSession, not withAuth: referring is open to every employee, and this
// returns only the PUBLISHED job board - the same list the public careers site
// serves to strangers. Gating it on recruitment:read (as the admin careers tree
// is) would leave everyone but HR with an empty dropdown.
export const GET = withSession(async (_req: NextRequest) => ok(await getReferableRoles()))
