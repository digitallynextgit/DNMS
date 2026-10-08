import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { getSignedUrl } from "@/lib/storage"
import { PERMISSIONS } from "@/lib/constants"
import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"

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

      // Prefer our stored CV copy: the marketing site's URL can expire, the B2 key can't.
      const data = await Promise.all(
        applications.map(async (a) =>
          a.resumeKey
            ? { ...a, resumeUrl: await getSignedUrl(a.resumeKey, 3600).catch(() => a.resumeUrl) }
            : a,
        ),
      )

      return NextResponse.json({
        data,
        meta: { ...paginationMeta(total, page, limit), newCount },
      })
    } catch (error) {
      console.error("[RECRUITMENT_APPLICATIONS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
