import { NextRequest, NextResponse } from "next/server"
import { withClientSession } from "@/server/api-handler"
import { getClientPlanAssetUrl } from "@/features/client-portal/server/client-plan.service"

// A permanent link (for exports) that 302s to a short-lived URL minted behind the client's session.
// Not public - published video uses /api/public/share/<token>.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string; fileId: string } }) => {
    const res = await getClientPlanAssetUrl(params.projectRef, params.fileId, {
      download: new URL(req.url).searchParams.get("download") === "1",
    })
    // Same answer for gone, not yours and never existed.
    if (!res.ok) return new NextResponse("Not found", { status: res.status ?? 404 })

    const url = (res.data as { data?: { url?: string } })?.data?.url
    if (!url) return new NextResponse("Not found", { status: 404 })

    // Drive assets come back as a relative stream path, Backblaze as an absolute signed URL.
    return NextResponse.redirect(new URL(url, req.url), {
      status: 302,
      // The target is signed and short-lived, so nothing may cache the redirect.
      headers: { "Cache-Control": "private, no-store" },
    })
  },
)
