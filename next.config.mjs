/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── WHY THIS IS CONFIGURABLE ────────────────────────────────────────────────
  // `next dev` and `next build` both write to .next, and Turbopack's dev cache
  // does not survive another process writing underneath it. Running a
  // verification build while a dev server is up corrupted the cache outright:
  //
  //   ENOENT ... .nextdevserverapp...uild-manifest.json
  //   Compaction failed: Another write batch or compaction is already active
  //
  // Recovery is "stop everything, delete .next, start again", which costs the
  // dev server's warm cache. Pointing a throwaway build at its own directory
  // avoids the collision entirely:
  //
  //   NEXT_DIST_DIR=.next-verify pnpm build
  //
  // Unset, this is exactly the default, so nothing changes for a normal build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  reactStrictMode: true,
  allowedDevOrigins: ["187.127.159.101", "digitallynext.tech", "dnms.digitallynext.com"],
  // Left as real runtime require()s instead of being bundled. pdf-parse wraps
  // pdfjs, which resolves worker files and does dynamic requires; bundled, it
  // fails at runtime - and the brand-brief reader reported that as "this PDF
  // has no text" about a PDF holding 12 pages of it. mammoth is the same shape.
  // pptxgenjs (deliverables slide deck) is a CJS bundle that reaches for fs /
  // https at runtime; leaving it external avoids the same class of failure.
  serverExternalPackages: ["exceljs", "sharp", "pdf-parse", "mammoth", "pptxgenjs"],
  experimental: {
    // This app has a proxy (middleware) at proxy.ts, so Next BUFFERS every request
    // body for the proxy to read - and silently TRUNCATES it at 10 MB by default.
    // A truncated multipart upload loses its closing boundary, so req.formData()
    // dies with "expected boundary after body" and the route 500s. That is what
    // broke every upload over 10 MB, no matter what the route limit or nginx's
    // client_max_body_size said.
    //
    // Keep this >= the largest upload the routes accept (250 MB in
    // projects/[id]/drive and projects/[id]/resources) and <= nginx's
    // client_max_body_size (250M), or uploads silently break again.
    // NOTE: `middlewareClientMaxBodySize` is the deprecated alias of this key.
    proxyClientMaxBodySize: "260mb",
    turbopackFileSystemCacheForDev: true,
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  typescript: {
    // ── DO NOT SET THIS TO false. IT IS NOT DEBRIS. ─────────────────────────
    // Type checking IS enforced - by `pnpm type-check`, which runs tsc with
    //
    //     node --max-old-space-size=8192
    //
    // because a project this size does not type-check inside the default heap.
    // `next build` runs tsc in its own build worker, which does NOT inherit that
    // flag, so turning this off makes the worker die on the deploy box:
    //
    //     Running TypeScript ...
    //     FATAL ERROR: Ineffective mark-compacts near heap limit
    //     Allocation failed - JavaScript heap out of memory
    //     Next.js build worker exited with code: null and signal: SIGABRT
    //
    // It reached ~2040 MB of a ~2048 MB cap before aborting. Nothing is skipped
    // by leaving this on: run `pnpm type-check` before deploying, which is the
    // gate that has the memory to do the job. To do it inside the build anyway,
    // give the worker the heap first and make sure the box has the RAM spare:
    //
    //     NODE_OPTIONS=--max-old-space-size=8192 pnpm build
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.backblazeb2.com",
      },
    ],
  },
  // ── SECURITY HEADERS ────────────────────────────────────────────────────────
  // Applied to every response (pages and API). Notes on the choices:
  //  - SAMEORIGIN, not DENY: the app iframes its OWN routes (project-mailer
  //    email preview, file-preview-sheet), so cross-origin framing is blocked
  //    while internal previews keep working.
  //  - CSP is REPORT-ONLY for now: Next inlines scripts and styles, so an
  //    enforcing policy needs nonces (or hash allow-lists) wired through the
  //    framework first. Report-only documents the target policy and surfaces
  //    violations in DevTools without breaking anything. Tighten, then enforce.
  //  - HSTS max-age 180 days, no preload: the app is also reached by bare IP in
  //    dev/staging (allowedDevOrigins above); browsers ignore HSTS on http and
  //    on IP hosts, so this is safe to send unconditionally.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ]
  },
}

export default nextConfig
