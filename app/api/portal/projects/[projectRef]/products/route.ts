import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { listClientProducts } from "@/features/client-portal/server/client-portal.queries"
import { productListQuerySchema } from "@/features/client-portal"

// GET /api/portal/projects/:projectRef/products
// The service re-proves the grant and the "products" module - the projectId in
// the URL is only a lookup key, never an authorisation.
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
