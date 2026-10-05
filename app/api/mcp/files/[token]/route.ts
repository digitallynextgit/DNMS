import { NextRequest, NextResponse } from "next/server"
import { heldFile, verifyLink } from "@/features/mcp/server/download-links"
import { rebuildFile } from "@/features/mcp/server/download.service"
import { resolvePrincipalByGrant } from "@/features/mcp/server/principal"
import { logToolCall } from "@/features/mcp/server/usage"
import { clientIp, rateLimited } from "@/lib/rate-limit"

// GET /api/mcp/files/[token] - where a download link from the AI connector
// lands (dnms_download / dnms_export_table). Opened in a browser, so there is
// no bearer token: the signed, 10-minute token IS the credential, and it names
// the connection it was issued to. proxy.ts lets /api/mcp/* through.
//
// Before serving anything the connection is looked up again, so a disconnected
// app, a deactivated person or a changed password stops the link immediately.

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const gone = (message: string, status = 410) =>
  new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DNMS download</title>` +
      `<body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">` +
      `<main style="max-width:420px;border:1px solid #262626;border-radius:12px;padding:24px;background:#111"><h1 style="font-size:18px;margin:0 0 8px">${message}</h1>` +
      `<p style="color:#a3a3a3;margin:0;line-height:1.5">Ask Claude or ChatGPT for the file again to get a fresh link.</p></main>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  )

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  if (rateLimited(`mcp:file:${clientIp(req)}`, 60, 60_000)) return gone("Too many downloads. Try again in a minute.", 429)

  const { token } = await ctx.params
  const link = verifyLink(token)
  if (!link) return gone("This download link has expired or is not valid.")

  const principal = await resolvePrincipalByGrant(link.g)
  if (!principal) return gone("This connection is no longer active.", 403)

  const started = Date.now()
  const file = heldFile(link.n, link.g)
  // The in-memory copy is gone (a restart) - a GET report can be rebuilt as the
  // same person, so permissions are checked again. A POST one cannot.
  const rebuilt = file ? null : await rebuildFile(principal, link.p)
  if (!file && !rebuilt) return gone("This file is no longer available.")
  const out = file ?? { ...rebuilt!, grantId: link.g, expiresAt: link.e }

  logToolCall(principal, {
    tool: "file_download",
    target: out.fileName,
    ok: true,
    status: 200,
    durationMs: Date.now() - started,
  })

  const asciiName = out.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
  return new NextResponse(Buffer.from(out.bytes), {
    status: 200,
    headers: {
      "content-type": out.contentType || "application/octet-stream",
      "content-length": String(out.bytes.byteLength),
      "content-disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(out.fileName)}`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  })
}
