import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { PERMISSIONS } from "@/lib/constants"
import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"

// GET /api/recruitment/applications - HR's inbox of careers applications.
// Filters: ?status= ?mode= ?q= (name/email/role) ?page= ?limit=
export const GET = withAuth(
  PERMISSIONS.RECRUITMENT_READ,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const sp = req.nextUrl.searchParams
      const { page, limit, skip, take } = resolvePagination(
        { page: sp.get("page"), limit: sp.get("limit") },
        20,
      )

      const status = sp.get("status")
      const mode = sp.get("mode")
      const q = sp.get("q")?.trim()

      const where: Prisma.CareerApplicationWhereInput = {
        ...(status && status !== "all"
          ? { status: status as Prisma.EnumCareerApplicationStatusFilter["equals"] }
          : {}),
        ...(mode && mode !== "all" ? { mode: mode as "FULL_TIME" | "INTERNSHIP" } : {}),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { roleTitle: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      }

      const [applications, total, newCount] = await Promise.all([
        db.careerApplication.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        db.careerApplication.count({ where }),
        db.careerApplication.count({ where: { status: "RECEIVED" } }),
      ])

      return NextResponse.json({
        data: applications,
        meta: { ...paginationMeta(total, page, limit), newCount },
      })
    } catch (error) {
      console.error("[RECRUITMENT_APPLICATIONS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
