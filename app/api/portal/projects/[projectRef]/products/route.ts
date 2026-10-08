import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { listClientProducts } from "@/features/client-portal/server/client-portal.queries"
import { productListQuerySchema } from "@/features/client-portal"

export const GET = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string } }) => {
    const sp = req.nextUrl.searchParams
    const query = productListQuerySchema.parse({
      search: sp.get("search") ?? undefined,
      status: sp.get("status") ?? undefined,
      channelId: sp.get("channelId") ?? undefined,
      page: sp.get("page") ?? undefined,
      pageSize: sp.get("pageSize") ?? undefined,
    })
    return respond(await listClientProducts(params.projectRef, query))
  },
)
