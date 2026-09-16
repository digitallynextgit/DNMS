import { NextRequest, NextResponse } from "next/server"
import { withClientSession } from "@/server/api-handler"
import { getClientPlanAssetUrl } from "@/features/client-portal/server/client-plan.service"

// GET - a PERMANENT link to one asset, which 302s to wherever it actually lives.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
// An export needs a url that is still good next week. Neither of the two we had
// is: a Backblaze url is SIGNED and dies in an hour, and Drive's own link shows
// a portal client a request-access page. So a spreadsheet could name the files
// but never point at them.
//
// This is the stable half: the id never changes, and the short-lived url is
// minted per request behind the client's session. Follow it while signed in and
// the file opens; follow it signed out and you get the login page, which is the
// correct answer for somebody else's client assets.
//
// NOT a public link. That is /api/public/share/<token>, which exists only for
// video the client deliberately published - see lib/drive-media.ts.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string; fileId: string } }) => {
    const res = await getClientPlanAssetUrl(params.projectRef, params.fileId, {
      download: new URL(req.url).searchParams.get("download") === "1",
    })
    // The service answers the same way for "gone", "not yours" and "never
    // existed", and that is the answer to pass on.
    if (!res.ok) return new NextResponse("Not found", { status: res.status ?? 404 })

    const url = (res.data as { data?: { url?: string } })?.data?.url
    if (!url) return new NextResponse("Not found", { status: 404 })

    // Drive-hosted assets come back as a RELATIVE stream path; Backblaze as an
    // absolute signed url. Resolving against the request handles both.
    return NextResponse.redirect(new URL(url, req.url), {
      status: 302,
      // The target is signed and short-lived, so nothing may hold on to it -
      // a cached redirect outliving its signature is a 403 in a week's time.
      headers: { "Cache-Control": "private, no-store" },
    })
  },
)
