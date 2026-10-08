import { NextRequest, NextResponse } from "next/server"
import { startAuthorization } from "@/features/mcp/server/oauth.service"
import { publicOrigin } from "@/features/mcp/server/config"
import { clientIp, rateLimited } from "@/lib/rate-limit"

// Public: the AI app sends the browser here before login. The id goes in the PATH because the
// proxy's login redirect keeps only the path.

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (rateLimited(`oauth:authorize:${clientIp(req)}`, 60, 60_000)) {
    return errorPage("Too many requests", "Wait a minute and try connecting again.", 429)
  }
  const outcome = await startAuthorization(req.nextUrl.searchParams)
  switch (outcome.type) {
    case "consent":
      return NextResponse.redirect(`${publicOrigin()}/oauth/consent/${outcome.requestId}`, 302)
    case "redirect":
      return NextResponse.redirect(outcome.url, 302)
    case "error":
      return errorPage(outcome.title, outcome.message, 400)
  }
}

/** For requests too broken to send back to the app. Plain HTML: the person may not be signed in. */
function errorPage(title: string, message: string, status: number) {
  const esc = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
    )
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · DNMS</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0a0a0a;color:#e5e5e5;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}main{max-width:440px;border:1px solid #262626;border-radius:12px;padding:28px;background:#111}h1{font-size:18px;margin:0 0 8px}p{color:#a3a3a3;line-height:1.5;margin:0}</style></head>
<body><main><h1>${esc(title)}</h1><p>${esc(message)}</p></main></body></html>`
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  })
}
